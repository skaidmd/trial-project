-- =====================================================
-- タスクリスト機能へのピボット
-- カテゴリベース → リストベースへの移行
-- =====================================================

-- ステップ1: 新しいテーブル構造の作成

-- 1-1. task_listsテーブル（タスクリスト）
CREATE TABLE IF NOT EXISTS task_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared BOOLEAN DEFAULT FALSE NOT NULL,
  invite_token TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 1-2. task_list_membersテーブル（リストメンバー）
CREATE TABLE IF NOT EXISTS task_list_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(task_list_id, user_id)
);

-- 1-3. tasksテーブルにtask_list_idを追加
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_list_id UUID REFERENCES task_lists(id) ON DELETE CASCADE;

-- ステップ2: インデックスの作成
CREATE INDEX IF NOT EXISTS task_lists_owner_id_idx ON task_lists(owner_id);
CREATE INDEX IF NOT EXISTS task_lists_invite_token_idx ON task_lists(invite_token);
CREATE INDEX IF NOT EXISTS task_list_members_task_list_id_idx ON task_list_members(task_list_id);
CREATE INDEX IF NOT EXISTS task_list_members_user_id_idx ON task_list_members(user_id);
CREATE INDEX IF NOT EXISTS tasks_task_list_id_idx ON tasks(task_list_id);

-- ステップ3: RLSを有効化
ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_list_members ENABLE ROW LEVEL SECURITY;

-- ステップ4: task_listsテーブルのRLSポリシー

-- SELECT: 自分が作成したか、メンバーとして参加しているリストのみ表示可能
CREATE POLICY "ユーザーは自分のリストまたは参加しているリストを表示可能"
  ON task_lists FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_list_members
      WHERE task_list_members.task_list_id = task_lists.id
      AND task_list_members.user_id = auth.uid()
    )
  );

-- INSERT: 認証済みユーザーは誰でもリスト作成可能
CREATE POLICY "認証済みユーザーはリストを作成可能"
  ON task_lists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: オーナーのみリストを更新可能
CREATE POLICY "オーナーはリストを更新可能"
  ON task_lists FOR UPDATE
  USING (owner_id = auth.uid());

-- DELETE: オーナーのみリストを削除可能
CREATE POLICY "オーナーはリストを削除可能"
  ON task_lists FOR DELETE
  USING (owner_id = auth.uid());

-- ステップ5: task_list_membersテーブルのRLSポリシー

-- SELECT: そのリストのメンバーはメンバー一覧を表示可能
CREATE POLICY "リストメンバーはメンバー一覧を表示可能"
  ON task_list_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_lists
      WHERE task_lists.id = task_list_members.task_list_id
      AND (
        task_lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_list_members tlm
          WHERE tlm.task_list_id = task_lists.id
          AND tlm.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: 認証済みユーザーは誰でもメンバーを追加可能（招待リンク用）
CREATE POLICY "認証済みユーザーはメンバーを追加可能"
  ON task_list_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: オーナーまたは自分自身を削除可能
CREATE POLICY "オーナーまたは自分自身を削除可能"
  ON task_list_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_lists
      WHERE task_lists.id = task_list_members.task_list_id
      AND task_lists.owner_id = auth.uid()
    )
  );

-- ステップ6: tasksテーブルのRLSポリシーを更新

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "グループメンバーはタスクを表示可能" ON tasks;
DROP POLICY IF EXISTS "グループメンバーはタスクを作成可能" ON tasks;
DROP POLICY IF EXISTS "グループメンバーはタスクを更新可能" ON tasks;
DROP POLICY IF EXISTS "グループメンバーはタスクを削除可能" ON tasks;

-- 新しいリストベースのポリシー

-- SELECT: 自分のリストまたは参加しているリストのタスクを表示可能
CREATE POLICY "ユーザーは自分のリストのタスクを表示可能"
  ON tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM task_lists
      WHERE task_lists.id = tasks.task_list_id
      AND (
        task_lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_list_members
          WHERE task_list_members.task_list_id = task_lists.id
          AND task_list_members.user_id = auth.uid()
        )
      )
    )
  );

-- INSERT: 自分のリストまたは参加しているリストにタスクを追加可能
CREATE POLICY "ユーザーは自分のリストにタスクを追加可能"
  ON tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_lists
      WHERE task_lists.id = tasks.task_list_id
      AND (
        task_lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_list_members
          WHERE task_list_members.task_list_id = task_lists.id
          AND task_list_members.user_id = auth.uid()
        )
      )
    )
  );

-- UPDATE: 自分のリストまたは参加しているリストのタスクを更新可能
CREATE POLICY "ユーザーは自分のリストのタスクを更新可能"
  ON tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM task_lists
      WHERE task_lists.id = tasks.task_list_id
      AND (
        task_lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_list_members
          WHERE task_list_members.task_list_id = task_lists.id
          AND task_list_members.user_id = auth.uid()
        )
      )
    )
  );

-- DELETE: 自分のリストまたは参加しているリストのタスクを削除可能
CREATE POLICY "ユーザーは自分のリストのタスクを削除可能"
  ON tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM task_lists
      WHERE task_lists.id = tasks.task_list_id
      AND (
        task_lists.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM task_list_members
          WHERE task_list_members.task_list_id = task_lists.id
          AND task_list_members.user_id = auth.uid()
        )
      )
    )
  );

-- ステップ7: データ移行関数（カテゴリ→リスト自動変換）
CREATE OR REPLACE FUNCTION migrate_categories_to_lists()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  category_record RECORD;
  new_list_id UUID;
  user_email_value TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'カテゴリからリストへの移行を開始...';
  RAISE NOTICE '========================================';
  
  -- 各ユーザーを処理
  FOR user_record IN
    SELECT DISTINCT user_id FROM tasks WHERE task_list_id IS NULL
  LOOP
    RAISE NOTICE 'ユーザー % を処理中...', user_record.user_id;
    
    -- メールアドレスを取得（空文字列をデフォルト）
    user_email_value := '';
    
    -- 各カテゴリを処理
    FOR category_record IN
      SELECT DISTINCT category 
      FROM tasks 
      WHERE user_id = user_record.user_id 
      AND task_list_id IS NULL
      ORDER BY category
    LOOP
      RAISE NOTICE '  カテゴリ「%」をリストに変換中...', category_record.category;
      
      -- カテゴリ名でリストを作成
      INSERT INTO task_lists (owner_id, name, is_shared)
      VALUES (user_record.user_id, category_record.category, false)
      RETURNING id INTO new_list_id;
      
      RAISE NOTICE '  作成されたリストID: %', new_list_id;
      
      -- オーナーとしてメンバーに追加
      INSERT INTO task_list_members (task_list_id, user_id, user_email, role)
      VALUES (new_list_id, user_record.user_id, user_email_value, 'owner');
      
      -- そのカテゴリのタスクにlist_idを設定
      UPDATE tasks
      SET task_list_id = new_list_id
      WHERE user_id = user_record.user_id
      AND category = category_record.category
      AND task_list_id IS NULL;
      
      RAISE NOTICE '  タスクの移行完了';
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '移行完了！';
  RAISE NOTICE '========================================';
END $$
LANGUAGE plpgsql;

-- ステップ8: 実行確認クエリ
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'マイグレーション準備完了！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '次のコマンドを実行してデータを移行してください:';
  RAISE NOTICE 'SELECT migrate_categories_to_lists();';
  RAISE NOTICE '========================================';
END $$;
