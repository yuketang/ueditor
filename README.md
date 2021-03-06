# Node.js : ueditor


[UEditor](https://github.com/fex-team/ueditor) 官方支持的版本有PHP JSP ASP .NET.

ueditor for nodejs 可以让你的UEditor支持nodejs

## ueditor@1.0.0 已经全面升级 。

##Installation

```
 npm install ueditor --save

```


## Usage

```javascript


var bodyParser = require('body-parser')
var ueditor = require("ueditor")
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json());

// /ueditor 入口地址配置 https://github.com/netpi/ueditor/blob/master/example/public/ueditor/ueditor.config.js
// 官方例子是这样的 serverUrl: URL + "php/controller.php"
// 我们要把它改成 serverUrl: URL + 'ue'
app.use("/ueditor/ue", ueditor(path.join(__dirname, 'public'), function(req, res, next) {

  // ueditor 客户发起上传图片请求

  if(req.query.action === 'uploadimage'){

    // 这里你可以获得上传图片的信息
    var foo = req.ueditor;
    console.log(foo.filename); // exp.png
    console.log(foo.encoding); // 7bit
    console.log(foo.mimetype); // image/png

    // 下面填写你要把图片保存到的路径 （ 以 path.join(__dirname, 'public') 作为根路径）
    var img_url = 'yourpath';
    res.ue_up(img_url, function(err, result){	// 上传
      console.log(err, result);					// 上传结束后在这里可以对结果进行进一步处理
      res.json(result)
    });
  }
  //  客户端发起图片列表请求
  else if (req.query.action === 'listimage'){
    var dir_url = 'your img_dir'; // 要展示给客户端的文件夹路径
    res.ue_list(dir_url) // 客户端会列出 dir_url 目录下的所有图片,如果配置了qn，则会列出ueditor上传到七牛的最近30天的图片
  }
  // 客户端发起其它请求
  else {

    res.setHeader('Content-Type', 'application/json');
    // 这里填写 ueditor.config.json 这个文件的路径
    res.redirect('/ueditor/ueditor.config.json')
}}));
```
### 七牛上传
```javascript

var bodyParser = require('body-parser')
var ueditor = require("ueditor")
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json());

// 支持七牛上传，如有需要请配置好qn参数，如果没有qn参数则存储在本地
app.use("/ueditor/ue", ueditor(path.join(__dirname, 'public'), {
    qn: {
        accessKey: 'your access key',
        secretKey: 'your secret key',
        bucket: 'your bucket name',
        host: 'http://{bucket}.u.qiniudn.com'
    }
}, function(req, res, next) {
  // ueditor 客户发起上传图片请求
  var imgDir = '/img/ueditor/'
  if(req.query.action === 'uploadimage'){
    var foo = req.ueditor;

    var imgname = req.ueditor.filename;


    res.ue_up(imgDir); //你只要输入要保存的地址 。保存操作交给ueditor来做
  }
  //  客户端发起图片列表请求
  else if (req.query.action === 'listimage'){

    res.ue_list(imgDir);  // 客户端会列出 dir_url 目录下的所有图片
  }
  // 客户端发起其它请求
  else {

    res.setHeader('Content-Type', 'application/json');
    res.redirect('/ueditor/ueditor.config.json')
}}));

```
### FDFS上传
```javascript

var bodyParser = require('body-parser')
var ueditor = require("ueditor")
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json());

//FDFS config 参数配置
var ueditorConfig = {
  fdfs: {
    /* Require 必须 */
    upload: {
      host: '192.168.0.40', //fdfs 上传服务器 host
      port: '22122'  // 上传服务器端口(一般默认22122)
    },
    download: {
      host: '192.168.0.82' //fdfs 下载服务器host
    },
    /* Require 必须 */
    /* 可缺省 */
    defaultExt: 'jpg', //默认后缀为png
    charset: 'utf8', //默认为utf8
    timeout: 20 * 1000 //默认超时时间10s
    /* 可缺省 */
  }
};

// 支持FDFS上传，upload跟download字段必填
app.use("/ueditor/ue", ueditor(path.join(__dirname, 'public'),  ueditorConfig, function(req, res, next) {
  // ueditor 客户发起上传图片请求
  var imgDir = '/img/ueditor/'
  if(req.query.action === 'uploadimage'){
    var foo = req.ueditor;

    var imgname = req.ueditor.filename;


    res.ue_up(imgDir); //你只要输入要保存的地址 。保存操作交给ueditor来做
  }
  //  客户端发起图片列表请求
  else if (req.query.action === 'listimage'){

    res.ue_list(imgDir);  // 客户端会列出 dir_url 目录下的所有图片
  }
  // 客户端发起其它请求
  else {

    res.setHeader('Content-Type', 'application/json');
    res.redirect('/ueditor/ueditor.config.json')
}}));

```

### 多类型文件上传 （附件 视频 图片）
```javascript

var bodyParser = require('body-parser')
var ueditor = require("ueditor")
app.use(bodyParser.urlencoded({
  extended: true
}))
app.use(bodyParser.json());

app.use("/ueditor/ue", ueditor(path.join(__dirname, 'public'), function(req, res, next) {
  var imgDir = '/img/ueditor/' //默认上传地址为图片
  var ActionType = req.query.action;
    if (ActionType === 'uploadimage' || ActionType === 'uploadfile' || ActionType === 'uploadvideo') {
        var file_url = imgDir;//默认上传地址为图片
        /*其他上传格式的地址*/
        if (ActionType === 'uploadfile') {
            file_url = '/file/ueditor/'; //附件保存地址
        }
        if (ActionType === 'uploadvideo') {
            file_url = '/video/ueditor/'; //视频保存地址
        }
        res.ue_up(file_url); //你只要输入要保存的地址 。保存操作交给ueditor来做
        res.setHeader('Content-Type', 'text/html');
    }
  //客户端发起图片列表请求
  else if (ActionType === 'listimage'){

    res.ue_list(imgDir);  // 客户端会列出 dir_url 目录下的所有图片
  }
  // 客户端发起其它请求
  else {
    res.setHeader('Content-Type', 'application/json');
    res.redirect('/ueditor/ueditor.config.json')
}}));

```

### 上传配置
```javascript
app.use("/ueditor/ue", static_url, config = {}, callback);
```
当config为空时，会默认把图片上传到 static_url + '/img/ueditor' 目录下。
比如例子“Usage”中图片会上传到项目的 public/img/ueditor 目录。

当配置了 config.qn 图片则只会上传到七牛服务器而不会上传到项目目录。
你可以来[ueditor:nodejs](http://blog.netpi.me/nodejs/ueditor-nodejs)给作者留言

