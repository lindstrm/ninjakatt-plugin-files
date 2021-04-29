const chokidar = require('chokidar');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { filename } = require(`${global.appRoot}/lib/helpers`);

const config = {
  responseType: 'arraybuffer',
};
const emitter = global.emitter;

module.exports = class Files {
  constructor() {
    this.construct(__dirname);
  }

  setup() {
    this.logDebug('Setting up files plugin');
    this.setupFileWatcher();
  }

  subscriptions() {
    this.subscribe('file.save', this.actOnFileSave);
    this.subscribe('file.download', this.actOnFileDownload);
  }

  /********* Event Functions *********/

  actOnFileSave = async (path, data) => {
    this.logDiag(`Acting on saved file: ${path}`);
    await fs.ensureFile(path);
    await fs.writeFile(path, data);
    return Promise.resolve(path);
  };

  actOnFileDownload = async (url, savePath, httpconfig, callback) => {
    this.logDiag(`Acting on downloaded file: ${savePath}`);
    callback = typeof httpconfig === 'function' ? httpconfig : callback;
    httpconfig = typeof httpconfig === 'function' ? null : httpconfig;
    savePath = await this.downloadFile(url, savePath, httpconfig).catch((e) => {
      const file = savePath.split(path.sep).pop();
      this.logError(`Error downloading ${file}, status: ${e}`);
    });
    if (callback) {
      return callback(path);
    } else {
      return Promise.resolve(path);
    }
  };

  /********* Plugin Functions *********/

  setupFileWatcher() {
    const watcher = chokidar.watch(this.settings.watchDir, this.settings.extras);
    watcher
      .on('add', (path) => {
        setTimeout(() => {
          this.logDiag(`File added: ${path}`);
          this.emit('file.add', path);
        }, 2000);
      })
      .on('change', (path) => {
        setTimeout(() => {
          this.logDiag(`File changed: ${path}`);
          this.emit('file.change', path);
        }, 2000);
      })
      .on('error', (error) => {
        this.logDebug(`Error from chokidar watch: ${error}`);
      });
  }

  async downloadFile(url, savePath, httpconfig, callback) {
    try {
      if (httpconfig) {
        httpconfig = { ...config, ...httpconfig };
      } else {
        httpconfig = config;
      }
      const file = await axios
        .get(url, httpconfig)
        .then((response) => response.data);

      if (!savePath.match('.')) {
        savePath = path.resolve(savePath, filename(url));
      }

      await fs.writeFile(savePath, file);
      this.logInfo(`Downloaded ${savePath}`);

      if (callback) {
        return callback(savePath);
      }

      return Promise.resolve(savePath);
    } catch (e) {
      this.logError(`Error while downloading file: ${url}`)
    }
  }
};
