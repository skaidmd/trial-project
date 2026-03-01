-- get_task_list_members関数の緊急修正
-- 実行日: 2026-03-01
-- 
-- 問題: パラメータ名がカラム名と衝突している
-- 解決: パラメータ名を変更し、シンプルな実装に変更

-- ステップ1: 問題のある関数を削除
DROP FUNCTION IF EXISTS get_task_list_members(uuid);

-- ステップ2: 修正版の関数を作成（パラメータ名を変更）
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
  -- 権限チェック：オーナーまたはメンバーのみアクセス可能
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
    -- オーナーならアクセス可能
    EXISTS (
      SELECT 1 FROM task_lists tl
      WHERE tl.id = p_list_id
      AND tl.owner_id = auth.uid()
    )
    OR
    -- メンバーならアクセス可能
    EXISTS (
      SELECT 1 FROM task_list_members tlm2
      WHERE tlm2.task_list_id = p_list_id
      AND tlm2.user_id = auth.uid()
    )
  )
  ORDER BY tlm.joined_at ASC;
$$;

-- ステップ3: 確認用クエリ
SELECT 
  routine_name,
  routine_type,
  security_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'get_task_list_members';

-- ステップ4: パラメータの確認
SELECT 
  routine_name,
  parameter_name,
  data_type,
  parameter_mode
FROM information_schema.parameters
WHERE specific_name IN (
  SELECT specific_name
  FROM information_schema.routines
  WHERE routine_name = 'get_task_list_members'
)
ORDER BY ordinal_position;
