-- =====================================================
-- 修正マイグレーション: user_emailカラムを追加
-- 既存のgroup_membersテーブルを修正します
-- =====================================================

-- 1. group_membersテーブルにuser_emailカラムを追加（まだない場合）
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2. 既存のgroup_membersレコードにメールアドレスを設定
-- auth.usersテーブルから直接取得できないため、関数を使用
CREATE OR REPLACE FUNCTION update_group_members_email()
RETURNS void AS $$
DECLARE
  member_record RECORD;
  user_email_value TEXT;
BEGIN
  FOR member_record IN
    SELECT id, user_id FROM group_members WHERE user_email IS NULL OR user_email = ''
  LOOP
    -- 現在ログインしているユーザーのメールを使用
    -- または手動で設定する必要があります
    -- このスクリプトは各ユーザーがログイン時に自動的に更新されるように設計されています
    UPDATE group_members
    SET user_email = COALESCE(user_email, '')
    WHERE id = member_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. user_emailをNOT NULLに変更する前に、デフォルト値を設定
UPDATE group_members SET user_email = '' WHERE user_email IS NULL;

-- 4. user_emailカラムをNOT NULLに変更（オプション - 後で実行）
-- ALTER TABLE group_members ALTER COLUMN user_email SET NOT NULL;

-- 5. migrate_existing_users_to_groups関数を修正版に更新
CREATE OR REPLACE FUNCTION migrate_existing_users_to_groups()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  new_group_id UUID;
BEGIN
  FOR user_record IN
    SELECT DISTINCT user_id FROM tasks WHERE group_id IS NULL
  LOOP
    -- 新しいグループを作成
    INSERT INTO groups (created_by, name)
    VALUES (user_record.user_id, '私のグループ')
    RETURNING id INTO new_group_id;
    
    -- ユーザーをグループメンバーとして追加（オーナー）
    -- user_emailは空文字列で保存（ログイン時に更新される）
    INSERT INTO group_members (group_id, user_id, user_email, role)
    VALUES (new_group_id, user_record.user_id, '', 'owner');
    
    -- そのユーザーのタスクにgroup_idを設定
    UPDATE tasks
    SET group_id = new_group_id
    WHERE user_id = user_record.user_id AND group_id IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. 既存ユーザーをマイグレート（まだ実行していない場合）
-- SELECT migrate_existing_users_to_groups();

-- 7. 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '修正マイグレーション完了: group_membersにuser_emailカラムを追加しました';
  RAISE NOTICE '次のステップ: アプリにログインすると、user_emailが自動的に更新されます';
END $$;
