-- =====================================================
-- グループ共有機能のマイグレーション
-- 既存のデータベースに実行してください
-- =====================================================

-- 1. グループテーブルの作成
CREATE TABLE IF NOT EXISTS groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '家族のグループ',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. グループメンバーテーブルの作成
CREATE TABLE IF NOT EXISTS group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- 3. 招待トークンテーブルの作成
CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days') NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. tasksテーブルにgroup_idカラムを追加
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- 5. インデックスの作成
CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members(user_id);
CREATE INDEX IF NOT EXISTS invite_tokens_token_idx ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS invite_tokens_group_id_idx ON invite_tokens(group_id);
CREATE INDEX IF NOT EXISTS tasks_group_id_idx ON tasks(group_id);

-- 6. RLSを有効化
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- 7. groupsテーブルのRLSポリシー
CREATE POLICY "グループメンバーはグループを表示可能"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "認証済みユーザーはグループを作成可能"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- 8. group_membersテーブルのRLSポリシー
CREATE POLICY "グループメンバーはメンバー一覧を表示可能"
  ON group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "グループオーナーはメンバーを追加可能"
  ON group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_members.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'owner'
    )
    OR NOT EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_members.group_id
    )
  );

-- 9. invite_tokensテーブルのRLSポリシー
CREATE POLICY "グループメンバーは招待トークンを表示可能"
  ON invite_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = invite_tokens.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "グループメンバーは招待トークンを作成可能"
  ON invite_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = invite_tokens.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- 10. tasksテーブルのRLSポリシーを削除して再作成
DROP POLICY IF EXISTS "ユーザーは自分のタスクのみ表示可能" ON tasks;
DROP POLICY IF EXISTS "ユーザーは自分のタスクのみ作成可能" ON tasks;
DROP POLICY IF EXISTS "ユーザーは自分のタスクのみ更新可能" ON tasks;
DROP POLICY IF EXISTS "ユーザーは自分のタスクのみ削除可能" ON tasks;

-- 新しいグループベースのRLSポリシー
CREATE POLICY "グループメンバーはタスクを表示可能"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "グループメンバーはタスクを作成可能"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "グループメンバーはタスクを更新可能"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "グループメンバーはタスクを削除可能"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- 11. 既存ユーザー用のマイグレーション関数
-- この関数を実行すると、既存の各ユーザーにグループが作成され、そのユーザーがオーナーになります
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
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (new_group_id, user_record.user_id, 'owner');
    
    -- そのユーザーのタスクにgroup_idを設定
    UPDATE tasks
    SET group_id = new_group_id
    WHERE user_id = user_record.user_id AND group_id IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 既存データをマイグレート（必要に応じて実行）
-- SELECT migrate_existing_users_to_groups();
