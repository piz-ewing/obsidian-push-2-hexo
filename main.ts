const path = require('path');
const fs = require('fs');

import { App, Plugin, PluginSettingTab, Setting, Notice, Vault } from "obsidian";
import { MarkdownView, FileSystemAdapter, TFile } from 'obsidian'

const DEFAULT_SETTINGS: P2HSettings = {
  hexoPostPath: "/tmp/",
  ribbonIcon: true,
};

export default class P2H extends Plugin {
  settings: P2HSettings;
  ribbonIconEl: HTMLElement | undefined = undefined;
  current_file_path: string;
  current_file_name: string;
  file_path_s: string[] = [];
  is_mac=process.platform == 'darwin';
  ctx: string;

  onInit() {}

  async onload() {
    console.log("p2h Plugin is Loading...");

    this.addSettingTab(new P2HSettingsTab(this.app, this));

    if (!this.is_mac) {
      this.settings.ribbonIcon = false;
      return;
    }

    await this.loadSettings();

    this.addCommand({
      id: 'obsidian-push-2-hexo',
      name: 'p2h post',
      callback: () => this.p2h('post'),
    });

    this.refreshIconRibbon();
  }

  onunload() {
    console.log("p2h Plugin is Unloading...");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
      await this.saveData(this.settings);
  }

  refreshIconRibbon = () => {
    this.ribbonIconEl?.remove();
    if (this.settings.ribbonIcon) {
        this.ribbonIconEl = this.addRibbonIcon('sync-small', 'push 2 hexo', (event): void => {
            this.p2h('post');
        });
    }
  };

  isExist = (file: string) => {
    try {
      fs.accessSync(file)
    }
    catch(e) {
      return false;
    }
    return true;
  }

  ensureDirectoryExists = (p:any) => {
      const d = path.dirname(p);
      if (d && d !== p) {
          this.ensureDirectoryExists(d);
      }
      if (!fs.existsSync(d)) {
          fs.mkdirSync(d);
      }
  }

  gen_file = () => {
    const post_dir = this.settings.hexoPostPath;
    const post_file_name = post_dir + '/' + this.current_file_name;

    this.ensureDirectoryExists(post_file_name + (this.file_path_s.length>0?'/x':''));

    try {
      fs.writeFileSync(post_file_name + '.md', this.ctx);

      for (var f in this.file_path_s) {
        const fp = this.file_path_s[f];
        fs.copyFileSync(fp, post_file_name+'/' + path.basename(fp));
      }
    } catch (err) {
      return new Notice("p2h error: " + err, 9999);
    }
    return new Notice("p2h success: " + this.current_file_name);
  }

  toggleLink = (ctx: string) => {
    const regexWiki = /\[\[([^\]]+)\]\]/
    const regexWikiGlobal = /\[\[([^\]]*)\]\]/g
    const regexHasExtension = /([^\\/]+)\.([^\\/]+)/i

    ctx = ctx.replace(new RegExp(regexWikiGlobal), (match, arg0) => {
      let wiki = match.match(regexWiki);
        if (wiki === null) return match;

        let filepath =wiki[1];

        var abs_filepath = path.resolve(this.current_file_path, filepath);

        if (!this.isExist(abs_filepath)) {
            abs_filepath += ".md";
            if (!_this.isExist(abs_filepath)) {
                var assets_filepath = path.resolve(_this.current_file_path, "assets", _this.current_file_name, filepath);
                if (!_this.isExist(assets_filepath)) {
                    return match;
                }
                abs_filepath = assets_filepath;
            }
        }

        const filename = abs_filepath.match(regexHasExtension);
        this.file_path_s.push(abs_filepath);
        let text = "[";
        if (filename !== null) {
            text += filename[1] +
            "](" + this.current_file_name + '/' +
            filename[1] + (filename.length > 2?'.'+filename[2]:"")
             + ")";
        }
        else {
          text += path.basename(abs_filepath) +
          "](" + this.current_file_name + '/' +
          path.basename(abs_filepath)
           + ")";
        }

        return text;
      });
      this.ctx = ctx;
  }

  read_current_file = () => {
    const { workspace } = this.app;
    const activeView = workspace.getActiveViewOfType(MarkdownView);

    if (activeView) {
      this.current_file_name = activeView.file.basename;
      if (activeView.file.vault.adapter instanceof FileSystemAdapter) {
        this.current_file_path = path.dirname((this.app.vault.adapter as FileSystemAdapter).getFullPath(activeView.file.path));
      }
      return this.app.vault.cachedRead(activeView.file);
    }
  }

  p2h = async (type: 'page' | 'post' | 'draft') => {
    if (type !== 'post') {
      return new Notice("!!todo");
    }

    let ctx = await this.read_current_file();

    if (!ctx) {
      return new Notice("p2h error: current file are not supported", 9999);
    }

    this.toggleLink(ctx);

    // create file and copy 2 path
    this.gen_file();
  };
}

interface P2HSettings {
  hexoPostPath: string;
  ribbonIcon: boolean;
}

class P2HSettingsTab extends PluginSettingTab {
  plugin: P2H;

  constructor(app: App, plugin: P2H) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();
    if (!this.plugin.is_mac) {
      containerEl.createEl('h2', { text: 'P2H Settings' });
      containerEl.createEl('h3', { text: 'Platforms other than macOS are not supported' });
      return;
    }

    containerEl.createEl('h2', { text: 'P2H Settings' });

    new Setting(containerEl)
      .setName('Hexo post dirpath')
      .setDesc(
          `postdir path`
      )
      .addText((text) =>
          text.setValue(settings.hexoPostPath).onChange((value) => {
              settings.hexoPostPath = value;
              this.plugin.saveSettings();
          })
    );

    new Setting(containerEl)
      .setName('Ribbon Icon')
      .setDesc('Turn on if you want Ribbon Icon for obsidian-push-2-hexo.')
      .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.ribbonIcon).onChange((value) => {
              this.plugin.settings.ribbonIcon = value;
              this.plugin.saveSettings();
              this.plugin.refreshIconRibbon();
          })
    );
  }
}

