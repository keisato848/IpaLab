
import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'プライバシーポリシーおよび免責事項 | シカクノ',
    description: 'シカクノのプライバシーポリシーおよび免責事項について記述しています。',
};

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg overflow-hidden">
                <div className="px-6 py-8 sm:p-10">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 border-b pb-4 mb-8">
                        プライバシーポリシーおよび免責事項
                    </h1>

                    <div className="space-y-8 text-gray-700 leading-relaxed">

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                1. 個人情報の収集と利用
                            </h2>
                            <p className="mb-4">
                                当サービス「シカクノ」では、サービスの質の向上と安全な利用環境を提供するために、以下の情報を収集・利用いたします。
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mb-4">
                                <li>
                                    <span className="font-bold">Googleアカウント情報:</span> 認証のためにGoogleアカウントを利用しており、お名前、メールアドレス、プロフィール画像を収集します。これらはユーザーの識別およびサービスの提供のみに使用されます。
                                </li>
                                <li>
                                    <span className="font-bold">学習データ:</span> 演習の回答履歴、進捗状況、正答率などのデータを保存し、学習の振り返りや分析機能の提供に利用します。
                                </li>
                            </ul>
                            <p>
                                これらの情報は、法令に基づく場合を除き、第三者に提供することはありません。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                2. 生成AIの利用について
                            </h2>
                            <p>
                                本サービスでは、記述式問題の採点および解説の一部に Google Gemini API を使用しています。
                                ユーザーが入力した回答データは、採点処理のためにAPI経由で送信されますが、
                                APIの設定により、送信されたデータがAIモデルの学習データとして再利用されることはありません。
                            </p>
                        </section>

                        <section className="bg-red-50 p-6 rounded-md border border-red-200">
                            <h2 className="text-xl font-bold text-red-800 mb-4 flex items-center">
                                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                3. 免責事項（重要）
                            </h2>
                            <ul className="list-disc pl-5 space-y-3 text-red-900">
                                <li>
                                    <span className="font-bold">コンテンツの正確性について:</span><br />
                                    当サービスに掲載されている過去問データ、解説、およびAIによる採点結果については、可能な限り正確を期しておりますが、その正確性、完全性、有用性を保証するものではありません。
                                    試験の合否判定や学習における最終的な判断は、公式情報をご参照ください。
                                </li>
                                <li>
                                    <span className="font-bold">責任の所在:</span><br />
                                    当サービスの利用によって生じた、いかなる損害（試験の不合格、学習の遅れ、データの消失、精神的苦痛など）についても、運営者は一切の責任を負いません。リスクをご理解の上、自己責任でご利用ください。
                                </li>
                                <li>
                                    <span className="font-bold">サービスの中断・変更:</span><br />
                                    運営上の都合により、予告なくサービスの内容を変更、または提供を停止する場合があります。これに伴い発生した損害についても責任を負いかねます。
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                4. Cookieおよびアクセス解析について
                            </h2>
                            <p>
                                当サービスでは、利用状況の分析やサービスの改善のために、Google Analytics 等のアクセス解析ツールや Cookie を使用する場合があります。
                                収集されるデータは匿名であり、個人を特定するものではありません。ブラウザの設定により Cookie を無効にすることも可能です。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                5. お問い合わせ
                            </h2>
                            <p>
                                本ポリシーやサービスに関するお問い合わせは、以下の連絡先までお願いいたします。
                            </p>
                            <p className="mt-2 text-gray-600 bg-gray-100 p-3 rounded inline-block">
                                お問い合わせ先: [GitHub Issues 等の連絡先URL、または admin@example.com]
                            </p>
                        </section>

                        <div className="pt-8 mt-12 border-t text-sm text-gray-500 text-center">
                            <p>&copy; 2024-2025 シカクノ All Rights Reserved.</p>
                            <div className="mt-4">
                                <a href="/" className="text-blue-600 hover:text-blue-800 hover:underline">トップページへ戻る</a>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
