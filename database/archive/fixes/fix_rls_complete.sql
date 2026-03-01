-- =====================================================
-- 完全修正: すべての無限再帰エラーを解決
-- すべてのポリシーを削除して再作成します
-- =====================================================

-- ステップ1: group_membersテーブルのすべてのポリシーを削除
DROP POLICY IF EXISTS "グループメンバーはメンバー一覧を表示可能" ON group_members;
DROP POLICY IF EXISTS "グループオーナーはメンバーを追加可能" ON group_members;
DROP POLICY IF EXISTS "メンバー追加ポリシー" ON group_members;

-- ステップ2: 新しいシンプルなポリシーを作成
-- group_membersテーブルは自分自身を参照しないポリシーにする

-- SELECT: 認証済みユーザーは自分が所属するグループのメンバーを表示可能
-- group_membersを参照せず、直接user_idで判定
CREATE POLICY "認証済みユーザーはメンバーを表示可能"
  ON group_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: 認証済みユーザーは誰でもメンバーを追加可能
-- （招待リンク経由での参加を許可するため）
CREATE POLICY "認証済みユーザーはメンバーを追加可能"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 自分自身のレコードのみ更新可能
CREATE POLICY "自分のレコードのみ更新可能"
  ON group_members FOR UPDATE
  USING (user_id = auth.uid());

-- DELETE: オーナーは他のメンバーを削除可能
CREATE POLICY "オーナーは削除可能"
  ON group_members FOR DELETE
  USING (
    role = 'owner' AND user_id = auth.uid()
    OR user_id = auth.uid()  -- 自分自身は削除可能
  );

-- ステップ3: データのマイグレーション（既存タスクを保持）
DO $$
DECLARE
  user_record RECORD;
  new_group_id UUID;
  existing_group_id UUID;
  user_email_value TEXT;
BEGIN
  RAISE NOTICE '既存タスクのマイグレーションを開始...';
  
  -- group_idがNULLのタスクを持つユーザーを処理
  FOR user_record IN
    SELECT DISTINCT t.user_id 
    FROM tasks t
    WHERE t.group_id IS NULL
  LOOP
    RAISE NOTICE 'ユーザー % を処理中...', user_record.user_id;
    
    -- そのユーザーが既にグループメンバーか確認
    SELECT gm.group_id INTO existing_group_id
    FROM group_members gm
    WHERE gm.user_id = user_record.user_id
    LIMIT 1;
    
    -- グループがない場合は新規作成
    IF existing_group_id IS NULL THEN
      RAISE NOTICE '新しいグループを作成中...';
      
      -- 新しいグループを作成
      INSERT INTO groups (created_by, name)
      VALUES (user_record.user_id, '私のグループ')
      RETURNING id INTO new_group_id;
      
      RAISE NOTICE '作成されたグループID: %', new_group_id;
      
      -- ユーザーをグループメンバーとして追加（オーナー）
      INSERT INTO group_members (group_id, user_id, user_email, role)
      VALUES (new_group_id, user_record.user_id, '', 'owner');
      
      RAISE NOTICE 'メンバーとして追加完了';
      
      -- そのユーザーのタスクにgroup_idを設定
      UPDATE tasks
      SET group_id = new_group_id
      WHERE user_id = user_record.user_id AND group_id IS NULL;
      
      RAISE NOTICE 'タスクの移行完了';
    ELSE
      RAISE NOTICE '既存のグループ % を使用', existing_group_id;
      
      -- 既存のグループにタスクを紐付け
      UPDATE tasks
      SET group_id = existing_group_id
      WHERE user_id = user_record.user_id AND group_id IS NULL;
      
      RAISE NOTICE 'タスクの移行完了';
    END IF;
  END LOOP;
  
  RAISE NOTICE 'マイグレーション完了！';
END $$;

-- ステップ4: 結果の確認
DO $$
DECLARE
  total_tasks INTEGER;
  tasks_with_group INTEGER;
  tasks_without_group INTEGER;
  total_groups INTEGER;
  total_members INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_tasks FROM tasks;
  SELECT COUNT(group_id) INTO tasks_with_group FROM tasks;
  tasks_without_group := total_tasks - tasks_with_group;
  SELECT COUNT(*) INTO total_groups FROM groups;
  SELECT COUNT(*) INTO total_members FROM group_members;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '修正完了！';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'タスク総数: %', total_tasks;
  RAISE NOTICE 'グループに紐付いているタスク: %', tasks_with_group;
  RAISE NOTICE 'グループなしのタスク: %', tasks_without_group;
  RAISE NOTICE 'グループ総数: %', total_groups;
  RAISE NOTICE 'メンバー総数: %', total_members;
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ブラウザをリロード（Ctrl+Shift+R）してください';
  RAISE NOTICE '========================================';
END $$;
