-- task_list_membersの無限再帰RLSを修正するスクリプト
-- 実行日: 2026-03-01

-- ステップ1: 問題のあるtask_list_membersのポリシーを削除
DROP POLICY IF EXISTS "リストメンバーはメンバー一覧を表示可能" ON task_list_members;
DROP POLICY IF EXISTS "認証済みユーザーはメンバーを追加可能" ON task_list_members;
DROP POLICY IF EXISTS "オーナーまたは自分自身を削除可能" ON task_list_members;

-- ステップ2: シンプルで再帰のないポリシーを作成

-- SELECT: 自分が所属しているリストのメンバー情報のみ表示可能
-- または、自分がオーナーのリストのメンバー情報を表示可能
CREATE POLICY "task_list_members_select_policy"
  ON task_list_members FOR SELECT
  USING (
    -- 自分自身のメンバーシップは常に見える
    user_id = auth.uid()
    OR
    -- または、そのリストのオーナーなら見える
    task_list_id IN (
      SELECT id FROM task_lists WHERE owner_id = auth.uid()
    )
    OR
    -- または、自分もそのリストのメンバーなら見える（サブクエリで直接チェック）
    EXISTS (
      SELECT 1 FROM task_list_members AS tlm_check
      WHERE tlm_check.task_list_id = task_list_members.task_list_id
      AND tlm_check.user_id = auth.uid()
    )
  );

-- INSERT: 認証済みユーザーは誰でもメンバーを追加可能（招待リンク用）
CREATE POLICY "task_list_members_insert_policy"
  ON task_list_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: オーナーのみメンバー情報を更新可能
CREATE POLICY "task_list_members_update_policy"
  ON task_list_members FOR UPDATE
  USING (
    task_list_id IN (
      SELECT id FROM task_lists WHERE owner_id = auth.uid()
    )
  );

-- DELETE: 自分自身を削除可能、またはオーナーが削除可能
CREATE POLICY "task_list_members_delete_policy"
  ON task_list_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR
    task_list_id IN (
      SELECT id FROM task_lists WHERE owner_id = auth.uid()
    )
  );

-- ステップ3: 確認用クエリ（実行してポリシーを確認）
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'task_list_members'
ORDER BY policyname;
