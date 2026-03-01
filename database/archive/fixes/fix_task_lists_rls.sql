-- task_listsの無限再帰RLSを修正するスクリプト（統合版）
-- 実行日: 2026-03-01
-- 
-- 問題: task_lists と task_list_members が相互参照して無限再帰
-- 解決: SECURITY DEFINER 関数を使用してRLSをバイパス

-- ステップ1: セキュリティ定義関数を作成（RLSをバイパス）

-- ユーザーが特定のリストのメンバーかチェックする関数
CREATE OR REPLACE FUNCTION is_task_list_member(list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_list_members
    WHERE task_list_id = list_id
    AND user_id = check_user_id
  );
$$;

-- ステップ2: 既存のtask_listsのポリシーを削除

DROP POLICY IF EXISTS "ユーザーは自分のリストまたは参加しているリストを表示可能" ON task_lists;
DROP POLICY IF EXISTS "認証済みユーザーはリストを作成可能" ON task_lists;
DROP POLICY IF EXISTS "オーナーはリストを更新可能" ON task_lists;
DROP POLICY IF EXISTS "オーナーはリストを削除可能" ON task_lists;

-- ステップ3: 再帰のない新しいポリシーを作成

-- SELECT: 自分が作成したか、メンバーとして参加しているリスト（関数を使用）
CREATE POLICY "task_lists_select_policy"
  ON task_lists FOR SELECT
  USING (
    owner_id = auth.uid()
    OR is_task_list_member(id, auth.uid())
  );

-- INSERT: 認証済みユーザーは誰でもリスト作成可能
CREATE POLICY "task_lists_insert_policy"
  ON task_lists FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: オーナーのみリストを更新可能
CREATE POLICY "task_lists_update_policy"
  ON task_lists FOR UPDATE
  USING (owner_id = auth.uid());

-- DELETE: オーナーのみリストを削除可能
CREATE POLICY "task_lists_delete_policy"
  ON task_lists FOR DELETE
  USING (owner_id = auth.uid());

-- ステップ4: 確認用クエリ
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('task_lists', 'task_list_members')
ORDER BY tablename, policyname;

-- ステップ5: 関数の確認
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'is_task_list_member';
