import * as vscode from "vscode";
import * as cheerio from "cheerio";

const registerPartsAsSnippet = async () => {
  // ワークスペースが開かれているか確認
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("ワークスペースが開かれていないため、パーツをスニペットに登録できません");
    return;
  }

  // 設定を取得
  const config = vscode.workspace.getConfiguration("fsePartsSnippetor");
  const targetSelector = config.get<string>("targetSelector") || "";
  const targetFilePath = config.get<string>("targetFilePath") || "";

  // 読み込むファイルのパスを定義
  const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, ...targetFilePath.split("/"));
  // スニペットファイルのパスを定義
  const snippetFilePath = vscode.Uri.joinPath(workspaceFolders[0].uri, ".vscode", "html.code-snippets");
  // 空のスニペットを定義
  const snippets: { [key: string]: { prefix: string; body: string[] } } = {};

  try {
    // ファイルの内容を読み込む
    const fileContent = await vscode.workspace.fs.readFile(filePath);

    // Unit8Arrayをstringに変換
    const fileContentString = Buffer.from(fileContent).toString("utf-8");

    // ファイルの内容をcheerioで解析
    const $ = cheerio.load(fileContentString, { xmlMode: true, decodeEntities: false });

    $(targetSelector).each((i: number, element: cheerio.Element) => {
      console.log(i, "--------------------------------------------------------------------------------------------------------------------------------");

      // 要素の階層構造に基づいてインデントを計算
      const lines: string[] = [];

      const processNode = (node: cheerio.Element, level: number) => {
        const $node = $(node);
        const originalHtml = $.html(node).trim();

        // 改行を含まない場合は一行で出力して終了
        if (!originalHtml.includes("\n")) {
          lines.push(getIndentedLine(originalHtml, level));
          return;
        }

        // 開始タグの処理
        const startTag = getStartTag(originalHtml);
        lines.push(getIndentedLine(startTag, level));

        // 子要素の処理
        processChildren($node, level);

        // 閉じタグの処理（自己終了タグでない場合）
        if (!startTag.endsWith("/>")) {
          const tagName = node.type === "tag" ? node.tagName : "test";
          const endTag = `</${tagName}>`;
          lines.push(getIndentedLine(endTag, level));
        }
      };

      // ヘルパー関数
      const getIndentedLine = (text: string, level: number): string => {
        // PHPの$変数をエスケープ処理
        const escapedText = text.replace(/(\$)(?=[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*)/g, "\\$");
        return "\t".repeat(level) + escapedText;
      };

      const getStartTag = (html: string): string => {
        return html.split("\n")[0].trim();
      };

      const processChildren = ($node: cheerio.Cheerio, level: number): void => {
        $node.contents().each((_, child) => {
          if (child.type === "text") {
            const text = $(child).text().trim();
            if (text) {
              lines.push(getIndentedLine(text, level + 1));
            }
          } else if (child.type === "tag") {
            processNode(child, level + 1);
          }
        });
      };

      processNode(element, 0);

      console.log(lines);
      const snippetName = `${$(element).attr("class")?.split(" ")[0]}-${("0" + (i + 1)).slice(-2)}`;
      snippets[snippetName] = {
        prefix: snippetName,
        body: lines,
      };
    });

    // スニペットファイルを保存
    await vscode.workspace.fs.writeFile(snippetFilePath, Buffer.from(JSON.stringify(snippets, null, 2), "utf-8"));

    vscode.window.showInformationMessage("パーツをスニペットに登録しました");
  } catch (error) {
    vscode.window.showErrorMessage(`ファイルの読み込みに失敗しました: ${error}`);
  }
};

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand("fsePartsSnippetor.registerPartsAsSnippet", registerPartsAsSnippet);
  context.subscriptions.push(disposable);
}

export function deactivate() {}
