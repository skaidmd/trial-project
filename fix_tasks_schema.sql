-- tasksテーブルから不要なcategoryカラムを削除
-- 実行日: 2026-03-01
-- 
-- 問題: categoryカラムがNOT NULL制約付きで残っているため、タスク追加時にエラー
-- 解決: categoryカラムを削除（新設計ではtask_list_idを使用）

-- ステップ1: categoryカラムの制約を確認（参考情報）
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks' 
AND column_name IN ('category', 'task_list_id', 'group_id');

-- ステップ2: categoryカラムを削除
ALTER TABLE tasks DROP COLUMN IF EXISTS category;

-- ステップ3: 古いgroup_idカラムも削除（新設計では不要）
ALTER TABLE tasks DROP COLUMN IF EXISTS group_id;

-- ステップ4: 確認 - tasksテーブルの現在の構造
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- ステップ5: 既存のtasksテーブルのデータ確認
SELECT 
  COUNT(*) as total_tasks,
  COUNT(task_list_id) as tasks_with_list_id,
  COUNT(*) - COUNT(task_list_id) as tasks_without_list_id
FROM tasks;
