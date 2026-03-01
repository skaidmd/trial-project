-- task_listsのSELECTポリシーを修正（招待リンク対応）
-- 実行日: 2026-03-01
-- 
-- 問題: 招待リンク経由のユーザーがまだメンバーでないため、リスト情報を取得できない
-- 解決: is_shared = true なら認証済みユーザーは誰でも見られるようにする

-- ステップ1: 既存のSELECTポリシーを削除
DROP POLICY IF EXISTS "task_lists_select_policy" ON task_lists;

-- ステップ2: 新しいSELECTポリシーを作成（招待リンク対応）
CREATE POLICY "task_lists_select_policy"
  ON task_lists FOR SELECT
  USING (
    owner_id = auth.uid()
    OR is_task_list_member(id, auth.uid())
    OR (is_shared = true AND invite_token IS NOT NULL AND auth.uid() IS NOT NULL)
  );

-- 説明:
-- 1. owner_id = auth.uid() : 自分が作成したリスト
-- 2. is_task_list_member(id, auth.uid()) : 自分が参加しているリスト
-- 3. (is_shared = true AND invite_token IS NOT NULL AND auth.uid() IS NOT NULL) : 
--    共有されていて、招待トークンがあり、認証済みなら誰でも見られる（招待リンク用）

-- ステップ3: 確認用クエリ
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'task_lists'
AND policyname = 'task_lists_select_policy';
