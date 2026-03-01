'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/src/utils/supabase/client';

export default function JoinGroupPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const [message, setMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setMessage('無効な招待リンクです');
      return;
    }

    handleJoinGroup();
  }, [token]);

  const handleJoinGroup = async () => {
    try {
      const supabase = createClient();

      // ログイン状態を確認
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // 未ログインの場合はログインページへ（招待トークンを保持）
        router.push(`/login?redirect=/join/${token}`);
        return;
      }

      // トークンの検証
      const { data: inviteData, error: inviteError } = await supabase
        .from('invite_tokens')
        .select('*, groups(name)')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (inviteError || !inviteData) {
        setStatus('invalid');
        setMessage('この招待リンクは無効または期限切れです');
        return;
      }

      setGroupName(inviteData.groups?.name || 'グループ');

      // 既にグループメンバーかチェック
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', inviteData.group_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        setStatus('success');
        setMessage('既にこのグループのメンバーです！');
        setTimeout(() => router.push('/'), 2000);
        return;
      }

      // グループに参加
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: inviteData.group_id,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) {
        console.error('参加エラー:', joinError);
        setStatus('error');
        setMessage('グループへの参加に失敗しました');
        return;
      }

      setStatus('success');
      setMessage('グループに参加しました！');
      
      // 2秒後にホームへリダイレクト
      setTimeout(() => router.push('/'), 2000);

    } catch (err: any) {
      console.error('エラー:', err);
      setStatus('error');
      setMessage('予期しないエラーが発生しました');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-800 mx-auto mb-4"></div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                グループに参加中...
              </h1>
              <p className="text-gray-600">
                しばらくお待ちください
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {message}
              </h1>
              {groupName && (
                <p className="text-gray-600 mb-4">
                  「{groupName}」へようこそ！
                </p>
              )}
              <p className="text-sm text-gray-500">
                自動的にホーム画面に移動します...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                エラー
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                ホームに戻る
              </button>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                無効なリンク
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                ホームに戻る
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
