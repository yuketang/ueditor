var Busboy = require('busboy');
var fs = require('fs');
var fse = require('fs-extra');
var os = require('os');
var path = require('path');
var snowflake = require('node-snowflake').Snowflake;
var qiniu = require('qiniu');
var uconfjson = require('./ueditor.config.json');
let FdfsClient = require('fdfs');
let moment = require('moment');

var isEmpty = function (obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

var getFdfs = function (fdfs) {

    return new FdfsClient({
        // tracker servers
        trackers: [{
            host: fdfs.upload.host,
            port: fdfs.upload.port
        }],
        // 默认超时时间10s
        timeout: fdfs.timeout || 10000,

        // 默认后缀
        // 当获取不到文件后缀时使用
        defaultExt: fdfs.defaultExt || 'png',
        // charset默认utf8
        charset: fdfs.charset || 'utf8'
    });
};

var ueditor = function (static_url, config = {}, handel) {
    return function (req, res, next) {
        var _respond = respond(static_url, config, handel);
        _respond(req, res, next);
    };
};
var respond = function (static_url, config = {}, callback) {
    if (typeof config === 'function') {
        callback = config
        config = {}
    }

    if (config.qn) config.qn.prefix = 'ue';

    return function (req, res, next) {
        res.setHeader('Content-Type', 'application/json');


        function jsonPRes(req, res, data) {
            if (req.query.callback) {
                res.end(`${req.query.callback}(${JSON.stringify(data)})`)
            } else {
                res.json(data)
            }
        }

        if (req.query.action === 'config') {
            return jsonPRes(req, res, config.uconfjson || uconfjson)
        } else if (req.query.action === 'listimage') {
            res.ue_list = function (list_dir) {
                var str = '';
                var i = 0;
                var list = [];
                fs.readdir(static_url + list_dir, function (err, files) {
                    if (err) throw err;

                    var total = files.length;
                    files.forEach(function (file) {

                        var filetype = 'jpg,png,gif,ico,bmp';
                        var tmplist = file.split('.');
                        var _filetype = tmplist[tmplist.length - 1];
                        if (filetype.indexOf(_filetype.toLowerCase()) >= 0) {
                            var temp = {};
                            if (list_dir === '/') {
                                temp.url = list_dir + file;
                            } else {
                                temp.url = list_dir + "/" + file;
                            }
                            list[i] = (temp);
                        } else {
                        }
                        i++;
                        // send file name string when all files was processed
                        if (i === total) {
                            jsonPRes(req, res, {
                                "state": "SUCCESS",
                                "list": list,
                                "start": 1,
                                "total": total
                            });
                        }
                    });
                });
            };
            //如果配置了fdfs则从fdfs.list列表读取图片url
            if (config.fdfs) {
                res.ue_list = function (list_dir) {
                    fs.readFile(static_url + list_dir + 'fdfs.list', function (err, data) {
                        var list = [];
                        if (data) {
                            var dataList = data.toString().split('\n');
                            dataList.forEach(function (item) {
                                if (item) list.push(JSON.parse(item))
                            })
                        }

                        jsonPRes(req, res, {
                            "state": 'SUCCESS',
                            "list": list,
                            "start": 1,
                            "total": list.length
                        });
                    })
                }
            }
            //如果配置了qn则从qiniu读取图片url列表
            if (config.qn) {
                res.ue_list = function () {

                    let listPrefix = new qiniu.rs.BucketManager(new qiniu.auth.digest.Mac(config.qn.accessKey,config.qn.secretKey), qiniu.zone[config.qn.zone]).listPrefix;
                    let funcs = [];
                    for (var i = 0; i < 30; i++) {
                        funcs.push(new Promise((resolve, reject) => {
                            listPrefix(config.qn.bucket, {prefix: `/ue_i/${moment().add(-i, 'days').format('YYYYMMDD')}/`}, function (err, result) {// /ue_i/20170908/
                                if (err) return reject(err);
                                let list = ((result || {}).items || []).map(item => {
                                        return {
                                            "url": config.qn.host + '/' + item.key,
                                            "original": '',
                                            "state": 'SUCCESS',
                                            "putTime": item.putTime
                                        }
                                    }
                                )
                                return resolve(list)
                            })
                        }));
                    }

                    Promise.all(funcs).then(result => {
                        let list = [];
                        result.map(item => {
                                list = list.concat(item)
                            }
                        )
                        list.sort((a, b) => b.putTime - a.putTime
                        ).map(item => {
                                return {
                                    "url": config.qn.host + '/' + item.key,
                                    "original": '',
                                    "state": 'SUCCESS'
                                }
                            }
                        )

                        jsonPRes(req, res, {
                            "state": 'SUCCESS',
                            "list": list,
                            "start": 1,
                            "total": list.length
                        });
                    }).catch(err => {
                        let list = [];
                        jsonPRes(req, res, {
                            "state": 'SUCCESS',
                            "list": list,
                            "start": 1,
                            "total": list.length
                        });
                    })
                    ;
                }
            }
            callback(req, res, next);

        } else if (req.query.action === 'uploadimage' || req.query.action === 'uploadfile' || req.query.action === 'uploadvideo') {
            var busboy = new Busboy({
                headers: req.headers
            });
            busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
                req.ueditor = {};
                req.ueditor.fieldname = fieldname;
                req.ueditor.file = file;
                req.ueditor.filename = filename;
                req.ueditor.encoding = encoding;
                req.ueditor.mimetype = mimetype;
                res.ue_up = function (img_url, cb) {
                    if (config.qn) {
                        if(typeof img_url === 'function') cb = img_url;

                        var name = snowflake.nextId() + path.extname(filename);
                        let prefix = req.query.action === 'uploadimage' ? 'ue_i' : (req.query.action === 'uploadfile' ? 'ue_f' : (req.query.action === 'uploadvideo' ? 'ue_v' : 'ue'))
                        let key = `${prefix}/${moment().format('YYYYMMDD')}/${name}`;

                        let uploadToken = new qiniu.rs.PutPolicy(config.qn).uploadToken(new qiniu.auth.digest.Mac(config.qn.accessKey,config.qn.secretKey));
                        let formUploader = new qiniu.form_up.FormUploader(qiniu.zone[config.qn.zone]);

                        formUploader.putStream(uploadToken, key, file, new qiniu.form_up.PutExtra(), function(err, results) {

                            if(err) return cb(err);
                            // res.setHeader('Content-Type', 'text/html');
                            cb(err, {
                                'mimetype': mimetype,
                                'url': config.qn.host + '/' + results.key,
                                'title': req.body.pictitle,
                                'size': results.fsize,
                                'original': filename,
                                'state': 'SUCCESS'
                            });
                        });
                        return false
                    } else {
                        var tmpdir = path.join(os.tmpdir(), path.basename(filename));
                        var name = snowflake.nextId() + path.extname(tmpdir);
                        var dest = path.join(static_url, img_url, name);
                        var writeStream = fs.createWriteStream(tmpdir);

                        file.pipe(writeStream);
                        writeStream.on("close", function () {
                            fse.move(tmpdir, dest, function (err) {
                                if (err)  return cb(err);
                                cb(err, {
                                    'url': path.join(img_url, name).replace(/\\/g, '/'),
                                    'title': req.body.pictitle,
                                    'original': filename,
                                    'state': 'SUCCESS'
                                });
                            });
                        })
                    }
                };
                callback(req, res, next);
            });
            req.pipe(busboy);
        } else {
            callback(req, res, next);
        }
        return;
    };
};
module.exports = ueditor;
