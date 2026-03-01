-- get_task_list_members関数の修正（シンプル版）
-- 実行日: 2026-03-01

-- ステップ1: 既存の関数を削除
DROP FUNCTION IF EXISTS get_task_list_members(uuid);

-- ステップ2: 新しい関数を作成
CREATE OR REPLACE FUNCTION get_task_list_members(p_list_id uuid)
RETURNS TABLE (
  id UUID,
  task_list_id UUID,
  user_id UUID,
  user_email TEXT,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    tlm.id,
    tlm.task_list_id,
    tlm.user_id,
    tlm.user_email,
    tlm.role,
    tlm.joined_at
  FROM task_list_members tlm
  WHERE tlm.task_list_id = p_list_id
  AND (
    EXISTS (
      SELECT 1 FROM task_lists tl
      WHERE tl.id = p_list_id
      AND tl.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM task_list_members tlm2
      WHERE tlm2.task_list_id = p_list_id
      AND tlm2.user_id = auth.uid()
    )
  )
  ORDER BY tlm.joined_at ASC;
$$;
