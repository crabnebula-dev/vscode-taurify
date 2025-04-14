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
  return text.replace(/(?:^|[^\\])(?:\\\\)*\\"/g, '\\"');
}

function escapeHtml(text: string) {
  return text.replace(/</g, '&lt;');
}

function createInitViewHTML(orgs: Record<string, string>, paths: string[]) {
  const scriptNonce = getNonce();
  const styleNonce = getNonce();
  return `<!doctype html>
<html>
<head>
  <title>Taurify: Initialization</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${styleNonce}'; script-src 'nonce-${scriptNonce}';" />
  <style type="text/css" nonce="${styleNonce}">
    ul { list-style: none; padding: 0; }
    h2 { padding: 10px 0px 0px 10px; }
    li { padding: 10px; }
    label { display: block; font-weight: 600; }
    label + p { margin-bottom: 15px; }
    fieldset { border: 0; padding: 0; }
    fieldset label { display: inline-block; }
    fieldset label + label { margin-left: 10px; }
    input[type="text"], input[type="password"], textarea { min-width: 16rem; }
    input[type="checkbox"] {
      appearance: none;
      border: none;
      background: inherit;
      width: 1.2rem;
      height: 1.2rem;
      background: var(--vscode-settings-textInputBackground, inherit);
      display: inline-block;
      vertical-align: -0.5rem;
    }
    input[type="checkbox"]:checked::before {
      content: '\\2713';
      position: absolute;
      margin: -0.1rem 0 0 -0.1rem;
    }
    input, select, textarea { background: var(--vscode-settings-textInputBackground, inherit); color: inherit; border: none; padding: 4px 6px; }
    input:focus, select:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    button { background: var(--vscode-button-background, inherit); color: inherit; border: none; padding: 4px; font: inherit; }
    #orgs span { margin-right: 10px; }
  </style>
</head>
<body>
  <h2>Taurify: Initialization</h2>
  <form id="init-form">
    <ul id="init">
      <li>
        <label for="project-path">Project path</label>
        <p>The path of the project that should be taurified.</p>
        <select id="project-path" name="projectPath">
          ${paths.map((path) => 
            `<option value="${escapeAttr(path)}">
              ${escapeHtml(path)}
            </option>`).join('\n')}
        </select>
      </li>
      <li>
        <label for="product-name">Product name</label>
        <p>The name of the product (used as application title).</p>
        <input type="text" id="product-name" name="productName" />
      </li>
      <li>
        <label for="identifier">Canonical identifier</label>
        <p>A canonical identifier for the product, e.g. com.mycompany.myapp.</p>
        <input type="text" id="identifier" name="identifier" />
      </li>
      <li>
        <label for="app-slug">Application slug</label>
        <p>The identifier for the application in your Cloud account.</p>
        <input type="text" id="app-slug" name="appSlug" />
      </li>
      <li>
        <label for="org-slug">Organization slug</label>
        <p>The identifier for the organization in your Cloud account. You can <a href="#new-org-slug">add organizations</a> below.</p>
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
        <p>The platform(s) for which binaries should be created.</p>
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
      <li>
        <label for="package-manager">Package manager</label>
        <p>The package manager your front-end uses.</p>
        <select id="package-manager" name="packageManger">
          <option value="npm">npm</option>
          <option value="pnpm">pnpm</option>
          <option value="yarn">yarn</option>
        </select>
      </li>
      <li>
        <label for="password">Password</label>
        <p>A hidden passphrase to create a key pair for your application to sign updates.</p>
        <input type="password" id="password" name="password" />
      </li>
      <li>
        <label for="run-before-dev">Run before dev</label>
        <p>The script to run (e.g. <code>npm run dev</code>) before dev is started.</p>
        <textarea id="run-before-dev" name="runBeforeDev"></textarea>
      </li>
      <li>
        <label for="run-before-build">Run before build</label>
        <p>The script to run (e.g. <code>npm run build</code>) before dev is started.</p>
        <textarea id="run-before-build" name="runBeforeBuild"></textarea>
      </li>
      <li>
        <label for="bootstrap">
          <input type="checkbox" id="bootstrap" name="bootstrap" value="true" />
          Bootstrap
        </label>
        <p>Is the application already present in the Cloud or does it need to be bootstrapped?</p>
      </li>
      <li>
        <button id="run-taurify-init">Initialize project</button>
      </li>
    </ul>
  </form>
  <h2>Taurify: Organizations</h2>
  <ul id="orgs">    
    <li id="add-org">
      <input type="text" id="new-org-slug" placeholder="Org slug" />
      <input type="password" id="new-org-key" placeholder="Org API key" />
      <button id="add-org-button">Add org</button>
    </li>
  </ul>
  <script type="text/javascript" nonce="${scriptNonce}">
    ((vscode) => {
      document.getElementById('init-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        // TODO: validation
        const formData = new FormData(ev.target);
        const initData = Object.fromEntries(formData.entries());
        initData.platforms = formData.getAll('platforms');
        vscode.postMessage({ init: initData });
      });
      function addOrg(slug) {
        const option = document.createElement('option');
        option.value = slug;
        option.appendChild(new Text(slug));
        document.getElementById('org-slug').appendChild(option);
        const item = document.createElement('li');
        const name = document.createElement('span');
        name.appendChild(new Text(slug));
        item.appendChild(name);
        const remove = document.createElement('button');
        remove.appendChild(new Text('delete'));
        remove.addEventListener('click', () => {
          vscode.postMessage({ deleteOrg: slug });
          item.remove();
          option.remove();
        });
        item.appendChild(remove);
        document.getElementById('orgs').insertBefore(
          item,
          document.getElementById('add-org')
        );        
      }
      (${JSON.stringify(Object.keys(orgs) || [])}).forEach(addOrg);
      document.getElementById('add-org-button').addEventListener('click', (ev) => {
        ev.preventDefault();
        const slugField = document.getElementById('new-org-slug');
        const keyField = document.getElementById('new-org-key');
        const slug = slugField.value;
        const key = keyField.value;
        if (slug && key) {
          vscode.postMessage({ addOrg: { slug, key } });
          addOrg(slug);
          slugField.value = keyField.value = '';
        } else {
          // TODO: error handling
          console.error('slug or key missing');
        }
      });
    })(acquireVsCodeApi());
  </script>
</body>
</html>`;
}

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
        { enableScripts: true }
      );
      initView.webview.html = createInitViewHTML(
        orgsKeys,
        vscode.workspace.workspaceFolders?.map(({name}) => name) ?? ['no folders found']
      );
      context.subscriptions.push(initView);

      initView.webview.onDidReceiveMessage(({ addOrg, deleteOrg, init }) => {
        let change = false;
        if (addOrg) {
          const { slug, key } = addOrg;
          orgsKeys[slug] = key;
          context.secrets.store(ORGS_SECRET_STORAGE_KEY, JSON.stringify(orgsKeys));
        }
        if (deleteOrg) {
          delete orgsKeys[deleteOrg];
          context.secrets.store(ORGS_SECRET_STORAGE_KEY, JSON.stringify(orgsKeys));
        }
        if (init) {
          console.log(init);
          /*
          const {
            productName, identifier, appSlug, orgSlug, projectPath, icon, platforms, 
            packageManager, password, runBeforeDev, runBeforeBuild, bootstrap
          } = init;
          const initCall = await runAbortable(
            `echo npx taurify init --product-name "${productName}" --indentifier "${identifier}" --org-slug "${orgSlug}" --app-slug "${appSlug}" --project-path "${projectPath}" --icon "${icon}" --platforms ${platforms} --package-manager ${packageManager} --password ${password} --runBeforeDev "${runBeforeDev}" --runBeforeBuild "${runBeforeBuild}" --bootstrap ${bootstrap}`,
            { env: { CN_API_KEY: orgsKeys[orgSlug] } }
          );
          context.subscriptions.push(initCall);
          */
        }
      });
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

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}