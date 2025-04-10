import * as vscode from "vscode";
import { exec, ExecOptions } from "node:child_process";
import { ObjectEncodingOptions } from "node:fs";

const ORGS_SECRET_STORAGE_KEY = 'taurify-orgs';

// debugging; TODO: remove
(globalThis as any).vscode = vscode;

const blocks = " ▏▎▍▌▋▊▉▉▉";

let statusBarItem: vscode.StatusBarItem;

const outputChannel = vscode.window.createOutputChannel("Taurify");

const runAbortable = async (
  command: string,
  options: ObjectEncodingOptions & ExecOptions = {}
) => {
  const abort = new AbortController();
  const process = await exec(command, { ...options, signal: abort.signal });
  const { stdout, stderr } = process;
  stdout?.on("data", (chunk) => outputChannel.append(chunk.toString()));
  stderr?.on("data", (chunk) => outputChannel.append(chunk.toString()));
  return Object.assign(new vscode.Disposable(() => abort.abort()), { process });
};

function escapeAttr(text: string) {
  return text.replace(/(?:^|[^\\])(?:\\\\)*\\"/g, '\\"')
}

function escapeHtml(text: string) {
  return text.replace(/</g, '&lt;');
}

function createInitViewHTML(orgs: Record<string, string>, paths: string[]) {
  return `<!doctype html>
<html>
<head>
  <title>Taurify: Initialization</title>
  <style>
    ul { list-style: none; padding: 0 0 20px 0; }
    h2 { padding-left: 10px; }
    li { padding: 10px; }
    label { display: block; }
    fieldset { border: 0; padding: 0; }
    fieldset label { display: inline-block; }
    fieldset label + label { margin-left: 10px; }
    input, select { background: var(--vscode-settings-textInputBackground, inherit); color: inherit; border: none; padding: 4px 6px; }
    input:focus, select:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    button { background: var(--vscode-button-background, inherit); color: inherit; border: none; padding: 4px; font: inherit; }
  </style>
</head>
<body>
  <h2>Taurify: Initialization</h2>
  <form id="init-form">
    <ul id="init">
      <li>
        <label for="project-path">Project path</label>
        <select id="project-path" name="projectPath">
          ${paths.map((path) => 
            `<option value="${escapeAttr(path)}">
              ${escapeHtml(path)}
            </option>`).join('\n')}
        </select>
      </li>
      <li>
        <label for="product-name">Product name</label>
        <input type="text" id="product-name" name="productName" />
      </li>
      <li>
        <label for="identifier">Canonical identifier</label>
        <input type="text" id="identifier" name="identifier" />
      </li>
      <li>
        <label for="app-slug">Application slug</label>
        <input type="text" id="app-slug" name="appSlug" />
      </li>
      <li>
        <label for="org-slug">Organization slug</label>
        <select id="org-slug" name="orgSlug">
          ${((orgSlugs) => orgSlugs.length
            ? orgSlugs.map(slug => `<option value="${escapeAttr(slug)}">
                ${escapeHtml(slug)}
              </option>`).join('\n')
            : '<option>No orgs configured</option>'
          )(Object.keys(orgs))}
        </select>
      </li>
      <li>
        <label for="platforms">Platforms</label>
        <fieldset id="platforms">
          <label for="platform-mac">Mac OS
            <input type="checkbox" id="platform-mac" name="platforms" value="mac" />
          </label>
          <label for="platform-windows">Windows
            <input type="checkbox" id="platform-windows" name="platforms" value="win" />
          </label>
          <label for="platform-linux">Linux
            <input type="checkbox" id="platform-linux" name="platforms" value="linux" />
          </label>
          <label for="platform-ios">iOS
            <input type="checkbox" id="platform-ios" name="platforms" value="ios" />
          </label>
          <label for="platform-android">Android
            <input type="checkbox" id="platform-android" name="platforms" value="android" />
          </label>
        </fieldset>
      </li>
    </ul>
    <button id="run-taurify-init">Initialize project</button>
  </form>
  <h2>Taurify: Organizations</h2>
  <ul id="orgs">
    <li id="loading">Loading...</li>
    <li id="add-org">
      <input type="text" id="new-org-slug" placeholder="Org slug" />
      <input type="password" id="new-org-key" placeholder="Org API key" />
      <button id="add-org-button">Add org</button>
    </li>
  </ul>
  <script>
    ((vscode) => {
      let orgs;
      function addOrg(slug) {
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.appendChild(new Text(slug));
        item.appendChild(name);
        const delete = document.createElement('button');
        delete.appendChild(new Text('delete'));
        delete.addEventListener('click', () => {
          if (orgs?.[slug]) {
            delete orgs[slug];
          }
          vscode.postMessage({ updateOrgs: orgs });
          item.remove();
        });
        item.appendChild(delete);
      }
      window.addEventListener('message', (event) => {
        if (Object.hasKey(event.data, 'initOrgs') && event.data.initOrgs instanceof Object) {
          document.getElementById('loading')?.remove();
          orgs = event.data.initOrgs ?? {};
          Object.keys(orgs).forEach(addOrg);
        }
      });
      document.getElementById('add-org-button').addEventListener('click', () => {
        const slug = document.getElementById('new-org-slug').value;
        const key = document.getElementById('new-org-key').value;
        if (slug && key) {
          vscode.postMessage{{ updateOrgs: { ...orgs, []} });
        } else {
          // TODO: error handling
        }
      });
    })(acquireVsCodeApi());
  </script>
</body>
</html>`;
}

/*class InitViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'taurify.initView';
  private view?: vscode.WebviewView;
  private orgs?: Record<string, string>;
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly secrets: vscode.SecretStorage,
  ) {}
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token?: vscode.CancellationToken
  ): Thenable<void> | void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = ;
    webviewView.webview.onDidReceiveMessage(data => {
      if (!data.updateOrgs) { 
        return;
      }
      this.secrets.store(ORGS_SECRET_STORAGE_KEY, JSON.stringify(data.updateOrgs ?? {}));
    });
    this.secrets.get(ORGS_SECRET_STORAGE_KEY).then((orgs) => {      
      try {
        orgs = JSON.parse(orgs ?? "{}");
      } catch(e) {}
      webviewView.webview.postMessage({ initOrgs: orgs });
    });
  }
  setOrgs(orgs: Record<string, string>) {
    this.orgs = orgs;
  }
  // TODO: store org (both new and overwrite old)
  // TODO: delete org
}*/


function getBar(progress: number) {
  const lastDigit = progress % 10;
  const firstDigit = (progress - lastDigit) / 10;
  return `${blocks[9].repeat(firstDigit)}${blocks[lastDigit]}`.trim();
}

function showProgress(progress: number) {
  if (progress !== 0) {
    statusBarItem!.text = `Taurification: ${getBar(progress)} ${progress}%`;
    statusBarItem!.accessibilityInformation = {
      role: "progressbar",
      label: "Taurification at ${progress} percent",
    };
    // TODO: use statusBarItem.tooltip = MarkdownString to provide additional information
  }
}

// TODO: use secret storage to store org slugs and api keys

/*
Configuration: 

organization API key (key-value based on org slug to handle multiple orgs)
android/ios app signing keys based on org slug
path to cn / cn.exe
*/

function noConfigFound() {
  statusBarItem!.text = "TODO: Taurify";
  statusBarItem!.command = "vscode-taurify.init";
  statusBarItem!.tooltip =
    "## Initialize this project with Taurify\n\nIf you click this status applet, your web app will be automatically converted to a tauri app.";
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  context.subscriptions.push(statusBarItem);
  statusBarItem.accessibilityInformation = { role: "button", label: "Taurify" };
  statusBarItem.show();
  statusBarItem.text = "Taurify";
  statusBarItem.command = {
    title: "Taurify commands",
    command: "workbench.action.quickOpen",
    arguments: [">Taurify"],
  };

  // check for taurify.json in project root
  vscode.workspace.findFiles("taurify.json").then(
    (found) => {
      if (found.length) {
        statusBarItem!.text = "Taurify";
      } else {
        noConfigFound();
      }
    },
    (error) => {
      console.error("taurify", error);
      noConfigFound();
    }
  );

  // const initViewProvider = new InitViewProvider(context.extensionUri, context.secrets);
  // const initView = vscode.window.registerWebviewViewProvider(InitViewProvider.viewType, initViewProvider);

  const initCommand = vscode.commands.registerCommand(
    "vscode-taurify.init",
    async () => {
      let orgsKeys;
      try {
        orgsKeys = JSON.parse(await context.secrets.get(ORGS_SECRET_STORAGE_KEY) ?? '{}');
      } catch(e) {
        console.warn('taurify: orgs secret keys were corrupted');
        orgsKeys = {};
      }
      console.log('open init view');
      const initView = vscode.window.createWebviewPanel(
        "taurify.initview",
        "Taurify",
        vscode.ViewColumn.One,
        { enableForms: true, enableScripts: true }
      );
      initView.webview.html = createInitViewHTML(
        orgsKeys,
        vscode.workspace.workspaceFolders?.map(({uri}) => uri.toString(true)) ?? ['no folders found']
      );
      context.subscriptions.push(initView);

      const orgSlugs = Object.keys(orgsKeys).filter(
        (key) => key !== "myOrgSlug"
      );
      let orgSlug = orgSlugs.length === 1 ? orgSlugs[0] : undefined;
      if (orgSlugs.length === 0) {
        
        return;
      } else if (orgSlugs.length > 1) {
        orgSlug = await vscode.window.showQuickPick(orgSlugs, {
          title: "Select your organization",
        });
      }
      if (!orgSlug) {
        vscode.window.showErrorMessage(
          "Org slug missing. Please select an org slug to initialize your taurify project."
        );
        return;
      }
      // TODO Custom View for configuration
      const productName = "";
      const identifier = "";
      const appSlug = "";
      const projectPath = vscode.workspace.workspaceFolders?.[0].uri;
      const icon = "";
      const platforms = "";
      const packageManager = "";
      const password = "";
      const runBeforeDev = "";
      const runBeforeBuild = "";
      const bootstrap = false;

      const initCall = await runAbortable(
        `echo npx taurify init --product-name "${productName}" --indentifier "${identifier}" --org-slug "${orgSlug}" --app-slug "${appSlug}" --project-path "${projectPath}" --icon "${icon}" --platforms ${platforms} --package-manager ${packageManager} --password ${password} --runBeforeDev "${runBeforeDev}" --runBeforeBuild "${runBeforeBuild}" --bootstrap ${bootstrap}`,
        { env: { CN_API_KEY: orgsKeys[orgSlug] } }
      );
      context.subscriptions.push(initCall);
    }
  );
  context.subscriptions.push(initCommand);

  const devCommand = vscode.commands.registerCommand(
    "vscode-taurify.dev",
    async () => {
      const devCall = await runAbortable("npx taurify dev");
      context.subscriptions.push(devCall);
    }
  );
  context.subscriptions.push(devCommand);

  const runCommand = vscode.commands.registerCommand(
    "vscode-taurify.run",
    async () => {
      const runCall = await runAbortable("npx taurify run");
      context.subscriptions.push(runCall);
    }
  );
  context.subscriptions.push(runCommand);

  const buildCommand = vscode.commands.registerCommand(
    "vscode-taurify.build",
    async () => {
      const buildCall = await runAbortable("npx taurify build");
      context.subscriptions.push(buildCall);
    }
  );
  context.subscriptions.push(buildCommand);

  const updateCommand = vscode.commands.registerCommand(
    "vscode-taurify.update",
    async () => {
      const updateCall = await runAbortable("npx taurify update");
      context.subscriptions.push(updateCall);
    }
  );
  context.subscriptions.push(updateCommand);

  /*

	const disposable = vscode.commands.registerCommand('vscode-taurify.taurify', () => {
		// if not present, show a convenient GUI around `npx taurify init` to create taurify.json
		// load settings: organization API key
		// if ios or android builds are selected, check for signing keys
		// if no signing keys are present, open the settings and the pages where you can apply for them
		// if organization API key is not present, open the settings and at the same time the page where you would get the API key if you are already logged in
		// actually start taurify and send actual update information
		showProgress(Math.floor(Math.random() * 101));
	});

	context.subscriptions.push(disposable);
	*/
}

export function deactivate() {
  // TOOO: stop taurification process if possible
}
