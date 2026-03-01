-- task_list_membersの循環参照を解決（最終版）
-- 実行日: 2026-03-01
-- 
-- 問題: task_list_members のポリシーが循環参照を引き起こしている
-- 解決: メンバー取得用の専用関数を作成し、ポリシーを最小限に

-- ステップ1: メンバー一覧を安全に取得する関数（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION get_task_list_members(list_id uuid)
RETURNS TABLE (
  id UUID,
  task_list_id UUID,
  user_id UUID,
  user_email TEXT,
  role TEXT,
  joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  -- アクセス権限をチェック
  IF NOT (
    EXISTS (SELECT 1 FROM task_lists WHERE id = list_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM task_list_members WHERE task_list_id = list_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- 権限があればメンバー一覧を返す
  RETURN QUERY
  SELECT 
    tlm.id,
    tlm.task_list_id,
    tlm.user_id,
    tlm.user_email,
    tlm.role,
    tlm.joined_at
  FROM task_list_members tlm
  WHERE tlm.task_list_id = list_id
  ORDER BY tlm.joined_at ASC;
END;
$$;

-- ステップ2: task_list_membersのポリシーを完全に再作成（循環参照を排除）

-- 既存のポリシーを全て削除
DROP POLICY IF EXISTS "task_list_members_select_policy" ON task_list_members;
DROP POLICY IF EXISTS "task_list_members_insert_policy" ON task_list_members;
DROP POLICY IF EXISTS "task_list_members_update_policy" ON task_list_members;
DROP POLICY IF EXISTS "task_list_members_delete_policy" ON task_list_members;

-- 新しいポリシー：自分自身のメンバーシップのみ見える
CREATE POLICY "task_list_members_select_own"
  ON task_list_members FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: 認証済みユーザーは誰でも追加可能（招待リンク用）
CREATE POLICY "task_list_members_insert_authenticated"
  ON task_list_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 自分自身のレコードのみ更新可能
CREATE POLICY "task_list_members_update_own"
  ON task_list_members FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: 自分自身のレコードのみ削除可能
CREATE POLICY "task_list_members_delete_own"
  ON task_list_members FOR DELETE
  USING (user_id = auth.uid());

-- ステップ3: 確認用クエリ

-- ポリシー一覧
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'task_list_members'
ORDER BY policyname;

-- 関数の確認
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name = 'get_task_list_members';

-- ステップ4: テスト用クエリ（実行してみる）
-- SELECT * FROM get_task_list_members('your-list-id-here'::uuid);
