-- tasksテーブルの無限再帰RLSを修正するスクリプト
-- 実行日: 2026-03-01
-- 
-- 問題: tasks のポリシーが task_list_members を参照して無限再帰
-- 解決: 既存の is_task_list_member() 関数を使用

-- ステップ1: 既存のtasksテーブルのポリシーを削除

DROP POLICY IF EXISTS "ユーザーは自分のリストのタスクを表示可能" ON tasks;
DROP POLICY IF EXISTS "ユーザーは自分のリストにタスクを追加可能" ON tasks;
DROP POLICY IF EXISTS "ユーザーは自分のリストのタスクを更新可能" ON tasks;
DROP POLICY IF EXISTS "ユーザーは自分のリストのタスクを削除可能" ON tasks;

-- ステップ2: ヘルパー関数を作成（ユーザーがリストにアクセスできるか）

CREATE OR REPLACE FUNCTION can_access_task_list(list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_lists
    WHERE id = list_id
    AND (
      owner_id = check_user_id
      OR is_task_list_member(list_id, check_user_id)
    )
  );
$$;

-- ステップ3: 再帰のない新しいポリシーを作成

-- SELECT: 自分がアクセスできるリストのタスクを表示可能
CREATE POLICY "tasks_select_policy"
  ON tasks FOR SELECT
  USING (can_access_task_list(task_list_id, auth.uid()));

-- INSERT: 自分がアクセスできるリストにタスクを追加可能
CREATE POLICY "tasks_insert_policy"
  ON tasks FOR INSERT
  WITH CHECK (can_access_task_list(task_list_id, auth.uid()));

-- UPDATE: 自分がアクセスできるリストのタスクを更新可能
CREATE POLICY "tasks_update_policy"
  ON tasks FOR UPDATE
  USING (can_access_task_list(task_list_id, auth.uid()));

-- DELETE: 自分がアクセスできるリストのタスクを削除可能
CREATE POLICY "tasks_delete_policy"
  ON tasks FOR DELETE
  USING (can_access_task_list(task_list_id, auth.uid()));

-- ステップ4: 確認用クエリ

-- ポリシー一覧
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY policyname;

-- 関数一覧
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name IN ('is_task_list_member', 'can_access_task_list')
ORDER BY routine_name;
