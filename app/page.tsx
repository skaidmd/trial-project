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
  created_at: string;
}

type Category = 'お使い' | 'イベント' | 'その他';

const CATEGORIES: Category[] = ['お使い', 'イベント', 'その他'];

const CATEGORY_COLORS = {
  'お使い': 'bg-blue-100 text-blue-800',
  'イベント': 'bg-purple-100 text-purple-800',
  'その他': 'bg-gray-100 text-gray-800',
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('お使い');
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  
  // クライアントサイドでのみSupabaseクライアントを初期化
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setMounted(true);
    
    try {
      const client = createClient();
      setSupabase(client);
    } catch (err: any) {
      console.error('Supabase初期化エラー:', err);
      // 環境変数が未設定の場合はログインページへ
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!supabase) return;
    
    fetchTasks();
    const unsubscribe = subscribeToTasks();
    fetchUser();
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [supabase]);

  const fetchUser = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  };

  const fetchTasks = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('タスク取得エラー:', error);
    } else {
      setTasks(data || []);
    }
    setLoading(false);
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
    if (!supabase || inputValue.trim() === '') return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('tasks').insert([
      {
        title: inputValue,
        category: selectedCategory,
        is_completed: false,
        user_id: user.id,
      },
    ]);

    if (error) {
      console.error('タスク追加エラー:', error);
    } else {
      setInputValue('');
    }
  };

  const toggleTask = async (task: Task) => {
    if (!supabase) return;
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !task.is_completed })
      .eq('id', task.id);

    if (error) {
      console.error('タスク更新エラー:', error);
    }
  };

  const deleteTask = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) {
      console.error('タスク削除エラー:', error);
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

  // サーバーサイドレンダリング時やSupabase初期化前は何も表示しない
  if (!mounted || !supabase) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* ヘッダー（モバイル最適化） */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900">
              家族のToDo
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              ログアウト
            </button>
          </div>
          {userEmail && (
            <p className="text-xs text-gray-500">{userEmail}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* タスク追加フォーム（モバイル最適化） */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="space-y-3">
            {/* カテゴリ選択（大きなタップ領域） */}
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

            {/* 入力フォーム */}
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="新しいタスクを入力..."
                className="flex-1 px-4 py-3.5 text-base border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
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

        {/* タスクリスト（カテゴリ別） */}
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
                          {/* チェックボックス（大きなタップ領域） */}
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

                          {/* タスク内容 */}
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

                          {/* 削除ボタン（大きなタップ領域） */}
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
    </div>
  );
}
