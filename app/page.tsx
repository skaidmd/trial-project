'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/src/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  category: string;
  is_completed: boolean;
  user_id: string;
  group_id: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  user_email: string;
  role: string;
}

type Category = 'お使い' | 'イベント' | 'その他';

const CATEGORIES: Category[] = ['お使い', 'イベント', 'その他'];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('お使い');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [mounted, setMounted] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const router = useRouter();
  
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setMounted(true);
    
    try {
      const client = createClient();
      setSupabase(client);
    } catch (err: any) {
      console.error('Supabase初期化エラー:', err);
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!supabase) return;
    
    initializeUser();
    
    const unsubscribe = subscribeToTasks();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [supabase]);

  const initializeUser = async () => {
    if (!supabase) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setUserEmail(user.email || '');
    
    // ユーザーのグループを取得または作成
    await ensureUserGroup(user.id);
  };

  const ensureUserGroup = async (userId: string) => {
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email || '';

    console.log('ensureUserGroup開始:', userId);

    // 既存のグループメンバーシップを確認（複数の可能性あり）
    const { data: memberships, error: membershipError } = await supabase
      .from('group_members')
      .select('group_id, user_email, role, groups(name)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false }); // 最新のグループを優先

    if (membershipError) {
      console.error('メンバーシップ取得エラー:', membershipError);
      return;
    }

    console.log('取得したメンバーシップ:', memberships);

    if (memberships && memberships.length > 0) {
      // 最新のグループを使用
      const membership = memberships[0];
      
      // user_emailが空の場合は更新
      if (!membership.user_email && userEmail) {
        await supabase
          .from('group_members')
          .update({ user_email: userEmail })
          .eq('user_id', userId)
          .eq('group_id', membership.group_id);
      }
      
      console.log('既存グループを使用:', membership.group_id);
      setGroupId(membership.group_id);
      fetchTasks(membership.group_id);
      fetchGroupMembers(membership.group_id);
    } else {
      // グループがない場合は作成
      console.log('新しいグループを作成中...');
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ created_by: userId, name: '私のグループ' })
        .select()
        .single();

      if (groupError) {
        console.error('グループ作成エラー:', groupError);
        return;
      }

      console.log('作成したグループ:', newGroup.id);

      // グループメンバーとして追加
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({ 
          group_id: newGroup.id, 
          user_id: userId, 
          user_email: userEmail,
          role: 'owner' 
        });

      if (memberError) {
        console.error('メンバー追加エラー:', memberError);
        return;
      }

      console.log('グループメンバーとして追加完了');
      setGroupId(newGroup.id);
      fetchTasks(newGroup.id);
      fetchGroupMembers(newGroup.id);
    }
  };

  const fetchUser = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  };

  const fetchTasks = async (gId?: string) => {
    if (!supabase) return;
    const currentGroupId = gId || groupId;
    if (!currentGroupId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('group_id', currentGroupId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('タスク取得エラー:', error);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  const fetchGroupMembers = async (gId: string) => {
    if (!supabase) return;
    
    const { data, error } = await supabase
      .from('group_members')
      .select('id, user_id, user_email, role')
      .eq('group_id', gId);

    if (error) {
      console.error('メンバー取得エラー:', error);
    } else {
      setGroupMembers(data || []);
    }
  };

  const subscribeToTasks = () => {
    if (!supabase) return;
    
    const channel = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const addTask = async () => {
    if (!supabase || inputValue.trim() === '' || !groupId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    const newTask: Task = {
      id: tempId,
      title: inputValue,
      category: selectedCategory,
      is_completed: false,
      user_id: user.id,
      group_id: groupId,
      created_at: new Date().toISOString(),
    };

    setTasks([newTask, ...tasks]);
    setInputValue('');

    const { data, error } = await supabase.from('tasks').insert([
      {
        title: newTask.title,
        category: selectedCategory,
        is_completed: false,
        user_id: user.id,
        group_id: groupId,
      },
    ]).select();

    if (error) {
      console.error('タスク追加エラー:', error);
      setTasks(tasks.filter(t => t.id !== tempId));
    } else if (data && data[0]) {
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === tempId ? data[0] : t)
      );
    }
  };

  const toggleTask = async (task: Task) => {
    if (!supabase) return;

    setTasks(tasks.map(t => 
      t.id === task.id ? { ...t, is_completed: !t.is_completed } : t
    ));

    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id);

    if (error) {
      console.error('タスク更新エラー:', error);
      setTasks(tasks.map(t => 
        t.id === task.id ? task : t
      ));
    }
  };

  const deleteTask = async (id: string) => {
    if (!supabase) return;

    const taskToDelete = tasks.find(t => t.id === id);
    setTasks(tasks.filter(t => t.id !== id));

    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) {
      console.error('タスク削除エラー:', error);
      if (taskToDelete) {
        setTasks([...tasks]);
      }
    }
  };

  const generateInviteLink = async () => {
    if (!supabase || !groupId) return;

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('invite_tokens')
      .insert({
        group_id: groupId,
        token: token,
        created_by: user.id,
      });

    if (error) {
      console.error('招待リンク生成エラー:', error);
      return;
    }

    const link = `${window.location.origin}/join/${token}`;
    setInviteLink(link);
    setShowShareModal(true);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('コピー失敗:', err);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addTask();
    }
  };

  const groupedTasks = {
    'お使い': tasks.filter((t) => t.category === 'お使い'),
    'イベント': tasks.filter((t) => t.category === 'イベント'),
    'その他': tasks.filter((t) => t.category === 'その他'),
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.is_completed).length;

  if (!mounted || !supabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900">
              家族のToDo
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={generateInviteLink}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                </svg>
                共有
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
          {userEmail && (
            <p className="text-xs text-gray-500">{userEmail}</p>
          )}
          {groupMembers.length > 1 && (
            <p className="text-xs text-gray-500 mt-1">
              👥 {groupMembers.length}人で共有中
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* タスク追加フォーム */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="space-y-3">
            <div className="flex gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                    selectedCategory === category
                      ? 'bg-gray-800 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="新しいタスクを入力..."
                className="flex-1 px-4 py-3.5 text-base text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-500"
              />
              <button
                onClick={addTask}
                className="px-6 py-3.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 active:bg-gray-900 transition-colors font-medium text-base shadow-sm"
              >
                追加
              </button>
            </div>
          </div>
        </div>

        {/* 統計情報 */}
        {totalTasks > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex justify-around text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalTasks}</p>
                <p className="text-xs text-gray-500 mt-1">合計</p>
              </div>
              <div className="border-l border-gray-200"></div>
              <div>
                <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
                <p className="text-xs text-gray-500 mt-1">完了</p>
              </div>
              <div className="border-l border-gray-200"></div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{totalTasks - completedTasks}</p>
                <p className="text-xs text-gray-500 mt-1">未完了</p>
              </div>
            </div>
          </div>
        )}

        {/* タスクリスト */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <p>読み込み中...</p>
          </div>
        ) : totalTasks === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-lg text-gray-400 mb-2">タスクがありません</p>
            <p className="text-sm text-gray-400">上のフォームから新しいタスクを追加してください</p>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const categoryTasks = groupedTasks[category];
              if (categoryTasks.length === 0) return null;

              return (
                <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900 flex items-center justify-between">
                      <span>{category}</span>
                      <span className="text-sm font-normal text-gray-500">
                        {categoryTasks.filter(t => !t.is_completed).length} / {categoryTasks.length}
                      </span>
                    </h2>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {categoryTasks.map((task) => (
                      <li key={task.id} className="p-4 hover:bg-gray-50 transition-colors active:bg-gray-100">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggleTask(task)}
                            className="flex-shrink-0 mt-0.5"
                          >
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                                task.is_completed
                                  ? 'bg-gray-800 border-gray-800'
                                  : 'border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              {task.is_completed && (
                                <svg
                                  className="w-4 h-4 text-white"
                                  fill="none"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2.5"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </button>

                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-base leading-relaxed break-words ${
                                task.is_completed
                                  ? 'line-through text-gray-400'
                                  : 'text-gray-900'
                              }`}
                            >
                              {task.title}
                            </p>
                          </div>

                          <button
                            onClick={() => deleteTask(task.id)}
                            className="flex-shrink-0 p-2 text-gray-400 hover:text-red-500 active:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 共有モーダル */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">家族を招待</h2>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-600 mb-4 text-sm">
              このリンクをLINEやメッセージで送信すると、家族がグループに参加できます。
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 mb-2">共有リンク</p>
              <p className="text-sm text-gray-900 break-all">{inviteLink}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="flex-1 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {copySuccess ? (
                  <>
                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                    コピーしました！
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    リンクをコピー
                  </>
                )}
              </button>
            </div>

            {groupMembers.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">メンバー ({groupMembers.length}人)</h3>
                <div className="space-y-2">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 text-sm">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-600 font-medium">
                          {member.user_email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-gray-700">{member.user_email}</span>
                      {member.role === 'owner' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">オーナー</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
