-- task_list_membersのエラーをデバッグ
-- 実行日: 2026-03-01

-- ステップ1: task_list_membersの現在のRLSポリシーを確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'task_list_members'
ORDER BY policyname;

-- ステップ2: RLSが有効か確認
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'task_list_members';

-- ステップ3: 実際にデータがあるか確認（管理者として）
-- この SELECT は RLS をバイパスして実行されます
SELECT COUNT(*) as total_members FROM task_list_members;

-- ステップ4: 関数の状態を確認
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name IN ('is_task_list_member', 'can_access_task_list', 'get_task_list_by_invite_token')
ORDER BY routine_name;
