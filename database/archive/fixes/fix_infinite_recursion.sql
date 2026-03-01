-- =====================================================
-- 緊急修正: 無限再帰エラーの解決
-- =====================================================

-- 1. 問題のあるRLSポリシーを削除
DROP POLICY IF EXISTS "グループオーナーはメンバーを追加可能" ON group_members;

-- 2. 正しいRLSポリシーを作成
-- 最初のメンバー（オーナー）は誰でも追加できる
-- 2人目以降はオーナーのみが追加できる
CREATE POLICY "メンバー追加ポリシー"
  ON group_members FOR INSERT
  WITH CHECK (
    -- ケース1: そのグループにまだメンバーがいない（最初のメンバー）
    NOT EXISTS (
      SELECT 1 FROM group_members existing
      WHERE existing.group_id = group_members.group_id
    )
    OR
    -- ケース2: 自分がそのグループのオーナーである
    EXISTS (
      SELECT 1 FROM group_members existing
      WHERE existing.group_id = group_members.group_id
      AND existing.user_id = auth.uid()
      AND existing.role = 'owner'
    )
  );

-- 3. 既存のタスクにgroup_idを設定（データを保持）
DO $$
DECLARE
  user_record RECORD;
  new_group_id UUID;
  user_email_value TEXT;
BEGIN
  -- group_idがNULLのタスクを持つユーザーを処理
  FOR user_record IN
    SELECT DISTINCT t.user_id 
    FROM tasks t
    WHERE t.group_id IS NULL
  LOOP
    -- そのユーザーが既にグループメンバーか確認
    SELECT gm.group_id INTO new_group_id
    FROM group_members gm
    WHERE gm.user_id = user_record.user_id
    LIMIT 1;
    
    -- グループがない場合は新規作成
    IF new_group_id IS NULL THEN
      -- 新しいグループを作成
      INSERT INTO groups (created_by, name)
      VALUES (user_record.user_id, '私のグループ')
      RETURNING id INTO new_group_id;
      
      -- メールアドレスを取得（空文字列をデフォルト）
      user_email_value := '';
      
      -- ユーザーをグループメンバーとして追加（オーナー）
      INSERT INTO group_members (group_id, user_id, user_email, role)
      VALUES (new_group_id, user_record.user_id, user_email_value, 'owner');
    END IF;
    
    -- そのユーザーのタスクにgroup_idを設定
    UPDATE tasks
    SET group_id = new_group_id
    WHERE user_id = user_record.user_id AND group_id IS NULL;
    
    RAISE NOTICE 'ユーザー % のタスクをグループ % に移行しました', user_record.user_id, new_group_id;
  END LOOP;
END $$;

-- 4. 確認
SELECT 
  COUNT(*) as total_tasks,
  COUNT(group_id) as tasks_with_group,
  COUNT(*) - COUNT(group_id) as tasks_without_group
FROM tasks;

-- 5. 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '修正完了！';
  RAISE NOTICE '- 無限再帰エラーを解決しました';
  RAISE NOTICE '- 既存のタスクはすべて保持されています';
  RAISE NOTICE '- ブラウザをリロードしてください';
  RAISE NOTICE '========================================';
END $$;
