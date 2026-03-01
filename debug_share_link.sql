-- 共有リンク問題のデバッグ用クエリ
-- 実行日: 2026-03-01

-- ステップ1: task_listsテーブルのinvite_tokenを確認
SELECT 
  id,
  name,
  owner_id,
  is_shared,
  invite_token,
  created_at
FROM task_lists
ORDER BY created_at DESC
LIMIT 10;

-- ステップ2: task_listsのRLSポリシーを確認
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'task_lists'
ORDER BY policyname;

-- ステップ3: task_list_membersのデータを確認
SELECT 
  tlm.id,
  tlm.task_list_id,
  tl.name as list_name,
  tlm.user_id,
  tlm.user_email,
  tlm.role,
  tlm.joined_at
FROM task_list_members tlm
JOIN task_lists tl ON tl.id = tlm.task_list_id
ORDER BY tlm.joined_at DESC
LIMIT 10;

-- ステップ4: 特定のトークンでリストを検索してみる（トークンを実際の値に置き換えて実行）
-- SELECT * FROM task_lists WHERE invite_token = 'your_actual_token_here';
