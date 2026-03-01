'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/src/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  is_completed: boolean;
  user_id: string;
  task_list_id: string;
  created_at: string;
}

interface TaskList {
  id: string;
  name: string;
  owner_id: string;
  is_shared: boolean;
  invite_token: string | null;
  created_at: string;
}

interface TaskListMember {
  id: string;
  user_id: string;
  user_email: string;
  role: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  
  // タブ切り替え
  const [activeTab, setActiveTab] = useState<'my' | 'shared'>('my');
  
  // リスト関連
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [tasksMap, setTasksMap] = useState<Record<string, Task[]>>({});
  const [membersMap, setMembersMap] = useState<Record<string, TaskListMember[]>>({});
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  
  // 入力関連
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});
  const [newListName, setNewListName] = useState('');
  const [showNewListInput, setShowNewListInput] = useState(false);
  
  // 共有モーダル
  const [shareModalListId, setShareModalListId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // ローディング
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();

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
    
    const unsubscribe = subscribeToChanges();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [supabase]);

  const initializeUser = async () => {
    if (!supabase) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    
    setUserEmail(user.email || '');
    setUserId(user.id);
    
    await fetchTaskLists();
  };

  const fetchTaskLists = async () => {
    if (!supabase) return;
    
    setLoading(true);
    
    // タスクリストを取得
    const { data: lists, error: listsError } = await supabase
      .from('task_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (listsError) {
      console.error('リスト取得エラー:', listsError);
      setLoading(false);
      return;
    }

    setTaskLists(lists || []);

    // 各リストのタスクとメンバーを取得
    if (lists && lists.length > 0) {
      const tasksPromises = lists.map(async (list) => {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('*')
          .eq('task_list_id', list.id)
          .order('created_at', { ascending: false });
        
        return { listId: list.id, tasks: tasks || [] };
      });

      const membersPromises = lists.map(async (list) => {
        const { data: members, error: membersError } = await supabase
          .rpc('get_task_list_members', { list_id: list.id });
        
        if (membersError) {
          console.error(`メンバー取得エラー (${list.name}):`, membersError);
          return { listId: list.id, members: [] };
        }
        
        return { listId: list.id, members: members || [] };
      });

      const [tasksResults, membersResults] = await Promise.all([
        Promise.all(tasksPromises),
        Promise.all(membersPromises)
      ]);
      
      const newTasksMap: Record<string, Task[]> = {};
      tasksResults.forEach(({ listId, tasks }) => {
        newTasksMap[listId] = tasks;
      });
      
      const newMembersMap: Record<string, TaskListMember[]> = {};
      membersResults.forEach(({ listId, members }) => {
        newMembersMap[listId] = members;
      });
      
      setTasksMap(newTasksMap);
      setMembersMap(newMembersMap);
    }
    
    setLoading(false);
  };

  const subscribeToChanges = () => {
    if (!supabase) return;
    
    const channel = supabase
      .channel('all_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_lists' }, () => {
        fetchTaskLists();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTaskLists();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_list_members' }, () => {
        fetchTaskLists();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createNewList = async () => {
    if (!supabase || !newListName.trim() || !userId) return;

    const { data, error } = await supabase
      .from('task_lists')
      .insert({
        name: newListName,
        owner_id: userId,
        is_shared: false,
      })
      .select()
      .single();

    if (error) {
      console.error('リスト作成エラー:', error);
      return;
    }

    if (data) {
      // オーナーとしてメンバーに追加
      await supabase
        .from('task_list_members')
        .insert({
          task_list_id: data.id,
          user_id: userId,
          user_email: userEmail,
          role: 'owner',
        });
    }

    setNewListName('');
    setShowNewListInput(false);
    fetchTaskLists();
  };

  const addTask = async (listId: string) => {
    if (!supabase || !newTaskInputs[listId]?.trim() || !userId) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTaskInputs[listId],
        task_list_id: listId,
        is_completed: false,
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('タスク追加エラー:', error);
      return;
    }

    // 即座にUIを更新
    if (data) {
      setTasksMap(prev => ({
        ...prev,
        [listId]: [data, ...(prev[listId] || [])],
      }));
    }

    setNewTaskInputs(prev => ({ ...prev, [listId]: '' }));
  };

  const toggleTask = async (task: Task) => {
    if (!supabase) return;

    // 楽観的更新
    setTasksMap(prev => ({
      ...prev,
      [task.task_list_id]: prev[task.task_list_id].map(t =>
        t.id === task.id ? { ...t, is_completed: !t.is_completed } : t
      ),
    }));

    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id);

    if (error) {
      console.error('タスク更新エラー:', error);
      // エラー時は元に戻す
      fetchTaskLists();
    }
  };

  const deleteTask = async (task: Task) => {
    if (!supabase) return;

    // 楽観的更新
    setTasksMap(prev => ({
      ...prev,
      [task.task_list_id]: prev[task.task_list_id].filter(t => t.id !== task.id),
    }));

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (error) {
      console.error('タスク削除エラー:', error);
      fetchTaskLists();
    }
  };

  const deleteList = async (listId: string) => {
    if (!supabase) return;
    if (!confirm('このリストを削除しますか？リスト内のタスクも全て削除されます。')) return;

    const { error } = await supabase
      .from('task_lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('リスト削除エラー:', error);
    } else {
      fetchTaskLists();
    }
  };

  const generateShareLink = async (listId: string) => {
    if (!supabase) return;

    const list = taskLists.find(l => l.id === listId);
    
    // 既にトークンがある場合はそれを使用
    if (list?.invite_token) {
      const link = `${window.location.origin}/join/${list.invite_token}`;
      setInviteLink(link);
      setShareModalListId(listId);
      return;
    }

    // 新しいトークンを生成
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const { error } = await supabase
      .from('task_lists')
      .update({ 
        invite_token: token,
        is_shared: true 
      })
      .eq('id', listId);

    if (error) {
      console.error('共有リンク生成エラー:', error);
      return;
    }

    const link = `${window.location.origin}/join/${token}`;
    setInviteLink(link);
    setShareModalListId(listId);
    fetchTaskLists();
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

  const toggleList = (listId: string) => {
    setExpandedLists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(listId)) {
        newSet.delete(listId);
      } else {
        newSet.add(listId);
      }
      return newSet;
    });
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // フィルタリング
  const filteredLists = taskLists.filter(list => {
    if (activeTab === 'my') {
      return list.owner_id === userId || !list.is_shared;
    } else {
      return list.is_shared;
    }
  });

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
            <h1 className="text-2xl font-bold text-gray-900">家族のToDo</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ログアウト
            </button>
          </div>
          {userEmail && <p className="text-xs text-gray-500">{userEmail}</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* タブ切り替え */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('my')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'my'
                ? 'bg-gray-800 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            📋 マイタスクリスト
          </button>
          <button
            onClick={() => setActiveTab('shared')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
              activeTab === 'shared'
                ? 'bg-gray-800 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            👥 共有タスクリスト
          </button>
        </div>

        {/* リスト一覧 */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <p>読み込み中...</p>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center mb-4">
            <p className="text-lg text-gray-400 mb-2">
              {activeTab === 'my' ? 'タスクリストがありません' : '共有されているリストがありません'}
            </p>
            <p className="text-sm text-gray-400">
              {activeTab === 'my' ? '下のボタンから新しいリストを作成してください' : '誰かがリストを共有するまで待ちましょう'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {filteredLists.map((list) => {
              const tasks = tasksMap[list.id] || [];
              const completedCount = tasks.filter(t => t.is_completed).length;
              const isExpanded = expandedLists.has(list.id);

              return (
                <div key={list.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* リストヘッダー */}
                  <div
                    onClick={() => toggleList(list.id)}
                    className="px-4 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-xl">{isExpanded ? '▼' : '▶'}</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          {list.name}
                          {list.is_shared && <span className="text-sm">👥</span>}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {completedCount}/{tasks.length} 完了
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => generateShareLink(list.id)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title="共有"
                      >
                        <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                          <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
                        </svg>
                      </button>
                      {list.owner_id === userId && (
                        <button
                          onClick={() => deleteList(list.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* タスク一覧（展開時） */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {/* メンバー一覧（共有リストの場合） */}
                      {list.is_shared && membersMap[list.id] && membersMap[list.id].length > 0 && (
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                          <p className="text-xs font-semibold text-blue-900 mb-2">共有メンバー</p>
                          <div className="flex flex-wrap gap-2">
                            {membersMap[list.id].map((member) => (
                              <span
                                key={member.id}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-200 rounded-full text-xs text-blue-900"
                              >
                                <svg className="w-3 h-3" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                  <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                </svg>
                                {member.user_email}
                                {member.role === 'owner' && (
                                  <span className="ml-1 text-blue-600 font-semibold">★</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* タスク追加フォーム */}
                      <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newTaskInputs[list.id] || ''}
                            onChange={(e) => setNewTaskInputs(prev => ({ ...prev, [list.id]: e.target.value }))}
                            onKeyPress={(e) => e.key === 'Enter' && addTask(list.id)}
                            placeholder="新しいタスクを入力..."
                            className="flex-1 px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 placeholder:text-gray-500"
                          />
                          <button
                            onClick={() => addTask(list.id)}
                            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            追加
                          </button>
                        </div>
                      </div>

                      {/* タスクリスト */}
                      {tasks.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                          タスクがありません
                        </div>
                      ) : (
                        <ul className="divide-y divide-gray-100">
                          {tasks.map((task) => (
                            <li key={task.id} className="p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => toggleTask(task)}
                                  className="flex-shrink-0 mt-0.5"
                                >
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                      task.is_completed
                                        ? 'bg-gray-800 border-gray-800'
                                        : 'border-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    {task.is_completed && (
                                      <svg className="w-3 h-3 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </button>
                                <p className={`flex-1 text-sm ${task.is_completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {task.title}
                                </p>
                                <button
                                  onClick={() => deleteTask(task)}
                                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                    <path d="M6 18L18 6M6 6l12 12"></path>
                                  </svg>
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 新規リスト作成 */}
        {activeTab === 'my' && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            {showNewListInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && createNewList()}
                  placeholder="新しいリスト名..."
                  autoFocus
                  className="flex-1 px-4 py-3 text-base text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 placeholder:text-gray-500"
                />
                <button
                  onClick={createNewList}
                  className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  作成
                </button>
                <button
                  onClick={() => {
                    setShowNewListInput(false);
                    setNewListName('');
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewListInput(true)}
                className="w-full py-3 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 4v16m8-8H4"></path>
                </svg>
                新規タスクリストを追加
              </button>
            )}
          </div>
        )}
      </div>

      {/* 共有モーダル */}
      {shareModalListId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShareModalListId(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">リストを共有</h2>
              <button onClick={() => setShareModalListId(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <p className="text-gray-600 mb-4 text-sm">
              このリンクをLINEやメッセージで送信すると、相手がこのリストに参加できます。
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 mb-2">共有リンク</p>
              <p className="text-sm text-gray-900 break-all">{inviteLink}</p>
            </div>

            <button
              onClick={copyToClipboard}
              className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
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
        </div>
      )}
    </div>
  );
}
