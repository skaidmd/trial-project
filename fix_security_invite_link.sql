-- 招待リンクのセキュリティ修正
-- 実行日: 2026-03-01
-- 
-- 問題: is_shared = true だと全認証ユーザーがリストを見られてしまう（セキュリティ問題）
-- 解決: 招待トークンによる検証専用の関数を作成し、通常のアクセスはメンバーのみに制限

-- ステップ1: 招待トークンでリスト情報を取得する安全な関数（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION get_task_list_by_invite_token(token TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  owner_id UUID,
  is_shared BOOLEAN,
  invite_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    id,
    name,
    owner_id,
    is_shared,
    invite_token,
    created_at
  FROM task_lists
  WHERE invite_token = token
  AND is_shared = true;
$$;

-- ステップ2: 既存のtask_listsのSELECTポリシーを修正（is_shared条件を削除）
DROP POLICY IF EXISTS "task_lists_select_policy" ON task_lists;

CREATE POLICY "task_lists_select_policy"
  ON task_lists FOR SELECT
  USING (
    owner_id = auth.uid()
    OR is_task_list_member(id, auth.uid())
  );

-- 説明:
-- 1. owner_id = auth.uid() : 自分が作成したリスト
-- 2. is_task_list_member(id, auth.uid()) : 自分が参加しているリスト
-- ※ is_shared = true による全体公開は削除（セキュリティ向上）

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

-- 関数の確認
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'get_task_list_by_invite_token';
