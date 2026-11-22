# サイトB — フレカ置き場2

サイトAと共通のデザインを使用したサイトB。保存先は既存のサイトB専用GASで、サイトA・Dとは分離されています。

- 公開: https://uoxou910.github.io/aiprif-private/
- 管理: https://uoxou910.github.io/aiprif-private/edit.html
- 旧公開（GAS変更まで利用可能）: https://uoxou910.github.io/aiprif-private/legacy-index.html
- 旧管理: https://uoxou910.github.io/aiprif-private/legacy-edit.html
- 上書き前のバックアップ: GitHub ブランチ `backup-before-site-a-design`

## 変更内容
- 公開画面：サイトAと同じ検索・フレカ表示・画像拡大・ページ送り・ヘッダー
- スマホ下部のキャラ切替バーとPC上部のキャラ切替タブを廃止
- 検索対象は「キャラ名＋コーデ名」（ひらがな／カタカナを正規化）
- 管理画面：フレカ管理のみ。所持コーデ・印刷予定はなし
- キャラ名は自由入力。既存の管理GASによるアップロード・編集・削除・公開切替を維持
- 管理者ログイン用パスワードは従来どおりGASで検証

## 重要：公開画面のパスワードなし閲覧にはGAS側の更新が必要
フロントエンドの閲覧パスワード入力は廃止済みですが、旧サイトBのGASでは `GET action=list` に `viewPassword` が必要です。

新公開画面を正常に表示するには、**サイトBの既存Apps Scriptソース**で `doGet(e)` の `action=list` 分岐だけを、`viewPassword` の照合なしで公開カードを返すよう変更してください。必ず `visible !== false` のカードだけを返し、`adminList`、`upload`、`update`、`visibility`、`delete`、`auth` の管理用認証はそのまま保持してください。変更後は **デプロイを管理 → 編集 → 新バージョン** で再デプロイします。

現行GASのソースはリポジトリにないため、正確な置換コードは現在の `Code.gs` を確認してから作成してください。手元のGASのパスワード・スクリプトプロパティの値はGitHubに書かないでください。

**公開化すると、公開フレカはURLを知っている誰でも閲覧可能になります。** 新ページでGASがまだ認証を要求するときは `legacy-index.html` を利用できます。

## データの扱い
既存フレカやGoogle Drive画像、GAS、スプレッドシートは変更していません。リポジトリ側の画面コードのみを変更しています。
