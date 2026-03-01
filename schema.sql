-- ユーザー認証テーブルはSupabaseのauth.usersを利用

-- tasksテーブルの作成
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('お使い', 'イベント', 'その他')),
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- インデックスの作成（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at DESC);

-- Row Level Security (RLS) を有効化
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 認証済みユーザーのみが自分のタスクを表示できる
CREATE POLICY "ユーザーは自分のタスクのみ表示可能"
  ON tasks
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLSポリシー: 認証済みユーザーのみが自分のタスクを作成できる
CREATE POLICY "ユーザーは自分のタスクのみ作成可能"
  ON tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLSポリシー: 認証済みユーザーのみが自分のタスクを更新できる
CREATE POLICY "ユーザーは自分のタスクのみ更新可能"
  ON tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLSポリシー: 認証済みユーザーのみが自分のタスクを削除できる
CREATE POLICY "ユーザーは自分のタスクのみ削除可能"
  ON tasks
  FOR DELETE
  USING (auth.uid() = user_id);
