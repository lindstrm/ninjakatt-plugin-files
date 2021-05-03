const chokidar = require('chokidar');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { extname } = require('path');
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
    const options = Object.assign({}, this.settings.extras, {
      ignored: (p) => {
        let ignore;
        if (!p.match(/\..+$/)) {
          ignore = false;
        } else {
          const file = p.split(path.sep).pop();
          ignore = !this.settings.extras.acceptedFileExtensions.includes(extname(file));
        }
        this.logDiag(`Checking file should be ignored: ${p} ${ignore}`);
        return ignore;
      }
    })
    const watcher = chokidar.watch(this.settings.watchDir, options);
    watcher
      .on('add', (path) => {
        this.logDiag(`File added: ${path}`);
        this.emit('file.add', path);
        watcher.unwatch(path);
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
