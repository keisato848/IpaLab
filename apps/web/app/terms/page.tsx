
import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '利用規約 | シカクノ',
    description: 'シカクノの利用規約について記述しています。',
};

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow-sm rounded-lg overflow-hidden">
                <div className="px-6 py-8 sm:p-10">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 border-b pb-4 mb-8">
                        利用規約
                    </h1>

                    <div className="space-y-8 text-gray-700 leading-relaxed">
                        <p className="mb-4">
                            この利用規約（以下，「本規約」といいます。）は，「シカクノ」（以下，「当サービス」といいます。）の利用条件を定めるものです。
                            ユーザーの皆様（以下，「ユーザー」といいます。）には，本規約に従って，当サービスをご利用いただきます。
                            当サービスを利用（ログインを含む）した時点で、本規約およびプライバシーポリシーに同意したものとみなします。
                        </p>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                1. サービスの提供
                            </h2>
                            <p>
                                当サービスは、情報処理技術者試験等の過去問題演習、学習履歴の管理、およびAIによる採点等の機能を提供します。
                                運営者は、事前の予告なく、本サービスの内容の変更、追加、または提供の中断、終了を行うことができるものとします。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                2. 禁止事項
                            </h2>
                            <p>ユーザーは，当サービスの利用にあたり，以下の行為をしてはなりません。</p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>法令または公序良俗に違反する行為</li>
                                <li>犯罪行為に関連する行為</li>
                                <li>当サービスのサーバーまたはネットワークの機能を破壊したり，妨害したりする行為（過度なアクセス、スクレイピング等を含む）</li>
                                <li>当サービスのサービスの運営を妨害するおそれのある行為</li>
                                <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                                <li>不正アクセスをし，またはこれを試みる行為</li>
                                <li>他のユーザーに成りすます行為</li>
                                <li>当サービスのサービスに関連して，反社会的勢力に対して直接または間接に利益を供与する行為</li>
                                <li>その他，運営者が不適切と判断する行為</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                3. 知的財産権
                            </h2>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>
                                    当サービスに含まれる過去問題（問題文、図表等）の著作権は、独立行政法人情報処理推進機構（IPA）に帰属します。
                                    当サービスは、IPAの許諾ないし引用の範囲内でこれらを利用しています。
                                </li>
                                <li>
                                    当サービス独自の解説、プログラム、デザイン、ロゴマーク、AIが生成した採点結果等のコンテンツに関する著作権および知的財産権は、運営者または正当な権利者に帰属します。
                                </li>
                                <li>
                                    ユーザーは、当サービスのコンテンツを無断で複製、転載、販売、再配布することはできません。
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                4. 免責事項
                            </h2>
                            <div className="bg-gray-100 p-4 rounded text-sm mb-2">
                                <p className="font-bold mb-2">※重要※</p>
                                <p>
                                    当サービスは、正確な情報の提供に努めますが、その内容の正確性、完全性、有用性を保証するものではありません。
                                    特に、AIによる採点や解説は誤りを含む可能性があります。
                                    試験の合否結果や、当サービスの利用に起因してユーザーに生じたあらゆる損害（学習機会の損失、データの消失等を含む）について、運営者は一切の責任を負いません。
                                </p>
                            </div>
                            <p>
                                運営者は、当サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                5. 利用制限および登録抹消
                            </h2>
                            <p>
                                運営者は，ユーザーが以下のいずれかに該当する場合には，事前の通知なく，ユーザーに対して，当サービスの全部もしくは一部の利用を制限し，またはユーザーとしての登録を抹消することができるものとします。
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li>本規約のいずれかの条項に違反した場合</li>
                                <li>登録事項に虚偽の事実があることが判明した場合</li>
                                <li>その他，運営者が当サービスの利用を適当でないと判断した場合</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                6. 利用規約の変更
                            </h2>
                            <p>
                                運営者は，必要と判断した場合には，ユーザーに通知することなくいつでも本規約を変更することができるものとします。
                                なお，本規約の変更後，当サービスを利用した場合には，当該ユーザーは変更後の規約に同意したものとみなします。
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-gray-800 mb-3 border-l-4 border-blue-500 pl-3">
                                7. 準拠法・裁判管轄
                            </h2>
                            <p>
                                本規約の解釈にあたっては，日本法を準拠法とします。
                                当サービスに関して紛争が生じた場合には，運営者の居住地を管轄する裁判所を専属的合意管轄とします。
                            </p>
                        </section>

                        <div className="pt-8 mt-12 border-t text-sm text-gray-500 text-center">
                            <p>&copy; 2024-2025 シカクノ All Rights Reserved.</p>
                            <div className="mt-4 space-x-4">
                                <a href="/" className="text-blue-600 hover:text-blue-800 hover:underline">トップページ</a>
                                <a href="/privacy" className="text-blue-600 hover:text-blue-800 hover:underline">プライバシーポリシー</a>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
