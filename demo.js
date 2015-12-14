var fs = require('fs');
var http2 = require('./node-http2');

var options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

var server = http2.createServer(options);
server.listen(8080);

var all_files = ['/index.html', '/file1.js', '/file2.js'];

loadFilesToCacheAsBuffer(all_files)
.then(function(){
  console.log("Starting server on 8080");
  server.on('request', route);
})
.catch(function(e){
  console.log(e);
})

var fileCache = {};

function route(req, res){

  if(req.url != '/'){
    return;
  }

  var count = 0;
  var page = all_files[0];        // Seperate out the actual page
  var files = all_files.slice(1);

  res.write(fileCache[page]);     // Write the page
  files.forEach(pushFile);        // Serve the deps with server push

  function pushFile(filename){
    var push = res.push(filename);  // Pushing to a specific route here. ex. /file.js
    push.setHeader("Content-Type", "text/javascript;charset=UTF-8")
    push.writeHead(200);
    push.write(fileCache[filename], null, function(err){
      count++;                    // The callback wrapping these comments is
      push.end();                 // called when push write completes. That
      if(count >= files.length){  // never happens on Firefox.
        return res.end();
      }
    })
  }

}

function loadFilesToCacheAsBuffer(files){
  var promises = [];
  files.forEach(function(file){
    promises.push(loadFileToBuffer(file));
  })
  return Promise.all(promises);
}

function loadFileToBuffer(path){
  function promiseFunction(resolve, reject){
    var relativePath = './' + path;
    fs.stat(relativePath, function(err, stats){
      if(err) return reject(err);
      var fileChunkArray = [];
      var fileStream = fs.createReadStream(relativePath);
      fileStream.on('data', function(data){
        fileChunkArray.push(data);
      })
      fileStream.on('end', function(){
        fileCache[path] = Buffer.concat(fileChunkArray, stats.size);
        return resolve();
      })
      fileStream.on('error', function(err){
        return reject(err);
      })
    })
  }
  return new Promise(promiseFunction);
}
