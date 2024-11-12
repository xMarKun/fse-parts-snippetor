import * as vscode from "vscode";
import * as cheerio from "cheerio";

interface Snippet {
  prefix: string;
  body: string;
}

interface SnippetFile {
  [name: string]: Snippet;
}

// パーツをスニペットに登録する
const saveDocumentListener = async (document: vscode.TextDocument) => {
  // ワークスペースが開かれているか確認
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return;

  // 設定を取得
  const config = vscode.workspace.getConfiguration("fsePartsSnippetor");
  const targetFilePath = vscode.Uri.joinPath(workspaceFolders[0].uri, config.get<string>("targetFilePath") || "").fsPath;
  const targetClasses = (config.get<string[]>("targetClasses") || []).map((className) => "." + className).join(",");

  // ファイルの言語がPHPで、ファイルのパスが設定のパスと一致するか確認
  if (document.languageId !== "php" || document.uri.fsPath !== targetFilePath) return;

  // スニペットファイルのパスを定義
  const snippetFilePath = vscode.Uri.joinPath(workspaceFolders[0].uri, ".vscode", "html.code-snippets");
  // 空のスニペットを定義
  const snippets: SnippetFile = {};

  // ファイルの内容を読み込む
  const fileContent = await vscode.workspace.fs.readFile(document.uri);

  // Unit8Arrayをstringに変換
  const fileContentString = Buffer.from(fileContent).toString("utf-8");

  // ファイルの内容をcheerioで解析
  const $ = cheerio.load(fileContentString);

  // スニペット名のカウンター（ベースクラスごとにカウント）
  const snippetCounter: { [key: string]: number } = {};

  $(targetClasses).each((_, element: cheerio.Element) => {
    const $element = $(element);
    const content = $.html($element.contents())
      // PHPの$変数をエスケープ処理
      .replace(/(\$)(?=[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/g, "\\$")
      // PHPがコメントアウトされる問題を解決するためのエスケープ処理
      .replace(/<!--\?php/g, "<?php")
      .replace(/\?-->/g, "?>")
      // 余分な改行を削除
      .trim();

    // クラス名を取得
    const classNames = $element.children().eq(0).attr("class")?.split(" ") || [];
    const baseClass = classNames[0] || "unknown-name";

    // すべてのモディファイアを取得
    const modifiers = classNames.filter((cls) => cls.startsWith(`${baseClass}--`)).map((cls) => cls.split("--")[1]);

    // ベースクラスでカウンターを更新
    snippetCounter[baseClass] = (snippetCounter[baseClass] || 0) + 1;
    const counter = ("0" + snippetCounter[baseClass]).slice(-2);

    // モディファイアの組み合わせを含むスニペット名を生成
    const modifierPart = modifiers.length > 0 ? `--${modifiers.join("--")}` : "";
    const snippetName = `@fse:${baseClass}-${counter}${modifierPart}`;

    // スニペットを登録
    snippets[snippetName] = {
      prefix: snippetName,
      body: content,
    };
  });

  // スニペットファイルを保存
  await vscode.workspace.fs.writeFile(snippetFilePath, Buffer.from(JSON.stringify(snippets, null, 2), "utf-8"));

  vscode.window.showInformationMessage("パーツをスニペットファイルに登録しました。");
};

// 拡張機能がアクティブになった時に実行される関数
export function activate(context: vscode.ExtensionContext) {
  console.log("FSE Parts Snippetor activated.");

  // ファイルを保存した時にパーツをスニペットに登録する
  const documentSaveListenerDisposable = vscode.workspace.onDidSaveTextDocument(saveDocumentListener);

  context.subscriptions.push(documentSaveListenerDisposable);
}

// 拡張機能が非アクティブになった時に実行される関数
export function deactivate() {
  console.log("FSE Parts Snippetor deactivated.");
}
