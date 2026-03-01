'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/src/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // クライアントサイドでのみSupabaseクライアントを初期化
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  useEffect(() => {
    setMounted(true);
    
    try {
      const client = createClient();
      setSupabase(client);
      
      // 環境変数の確認
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      console.log('Supabase設定確認:');
      console.log('URL:', url);
      console.log('Key:', key ? `${key.substring(0, 20)}...` : '未設定');
    } catch (err: any) {
      console.error('Supabase初期化エラー:', err);
      setError(err.message);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supabase) {
      setError('Supabaseクライアントが初期化されていません。環境変数を確認してください。');
      return;
    }
    
    setError('');
    setSuccessMessage('');
    setLoading(true);

    console.log('認証処理開始:', isSignUp ? '新規登録' : 'ログイン');

    try {
      if (isSignUp) {
        console.log('signUp実行中...');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          },
        });
        
        console.log('signUp結果:', { data, error });
        
        if (error) throw error;
        
        // メール確認が必要かどうかをチェック
        if (data?.user?.identities?.length === 0) {
          setError('このメールアドレスは既に登録されています。ログインしてください。');
        } else if (data?.user && !data.user.email_confirmed_at) {
          setSuccessMessage('登録完了！確認メールを送信しました。メール内のリンクをクリックして認証を完了してください。');
          setIsSignUp(false);
        } else if (data?.user) {
          setSuccessMessage('登録完了！ログインできます。');
          setIsSignUp(false);
        }
      } else {
        console.log('signInWithPassword実行中...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        console.log('signIn結果:', { data, error });
        
        if (error) throw error;
        
        console.log('ログイン成功、リダイレクト中...');
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      console.error('認証エラー:', err);
      setError(err.message || '認証に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // サーバーサイドレンダリング時は何も表示しない
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              連絡帳
            </h1>
            <p className="text-gray-600">
              {isSignUp ? 'アカウントを作成' : 'ログイン'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-500"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 text-gray-900 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent placeholder:text-gray-500"
                placeholder="6文字以上"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !supabase}
              className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '処理中...' : isSignUp ? '新規登録' : 'ログイン'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setSuccessMessage('');
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              {isSignUp ? 'すでにアカウントをお持ちですか？ログイン' : 'アカウントをお持ちでないですか？新規登録'}
            </button>
          </div>

          {/* デバッグ情報 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-semibold mb-2">💡 開発者向け情報:</p>
            <p>ブラウザのコンソール（F12）で詳細なログを確認できます。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
