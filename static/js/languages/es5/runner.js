this.Runner = class Runner {
  constructor(microvm) {
    this.microvm = microvm;
  }

  init() {
    var kd, key, src;
    this.initialized = true;
    window.ctx = this.microvm.context.global;
    window.ctx.print = (text) => {
      return this.microvm.context.meta.print(text);
    };
    src = "";
    for (key in this.microvm.context.global) {
      kd = key;
      if (key === "Image") {
        kd = "msImage";
      }
      if (key === "Map") {
        kd = "msMap";
      }
      src += `${kd} =  window.ctx.${key};\n`;
    }
    return this.run(src);
  }

  async addFiles(filename,data){
  return await new Promise((resolve,reject)=>{
    fs.writeFile(fs.join("/folder", filename+".js"), 
      new fs.Buffer(data,"utf-8"), 
      function(err) {
        if (err){
          reject(err) //Bubble this up to the player to be displayed
        }
        resolve()
      })
    })
  }

  getFunctionSource(functionName){
    console.debug(functionName)
    if(!window.moduleOutput){
      return null
    }
    return window.moduleOutput[functionName] 
  }
  async compile(){
    var compiler = webpack({
      inputFileSystem: fs,
      outputFileSystem: fs,
      context: "/folder",
      entry: "./main.js",
      module: {
          loaders: []
      },
      output: {
          path: "/output",
          filename: "bundle.js"
      },
      optimize: {
          maxChunks: 1
      }
    });
    return new Promise((resolve, reject)=>{
      compiler.run(function(err, stats) {
        console.log(err,stats)
        if(stats.hasErrors()){
          reject(stats.compilation.errors[0].error.message)
        }
        if(err){
          reject(err)
        }
        resolve(stats)
      })
    })
  }

  async run(program, name = "",callback,sources) {
    var err, file, line;
    if (!this.initialized) {
      this.init();
    }
    let promises = []
    for(let file in sources){
      promises.push(this.addFiles(file,sources[file]))
    }
    await Promise.all(promises)
    try{
    await this.compile()
    } catch (error){
      console.log(error)
    }
    let output = fs.readFileSync("/output/bundle.js");
    console.log(output)
    try {
      return window.eval("moduleOutput = "+output.toString());
    } catch (error) {
      //todo get sourcemaps and map error to source
      console.log(error);
    }
  }

  call(name, args) {
    var err, file, line;
    var Window = window;
    var output;
    try {
      if (window.moduleOutput[name] != null) {
        // For some reason the global this doesn't set the microvm.context.globals like javascript so lets cache the globals and inject microvm context.
        (function(window) {
          var cache = {};
          for (var key in window) cache[key] = key;
          window.cache = cache;
        })(window);
          for(let key in this.microvm.context.global){
            window[key] = this.microvm.context.global[key]
          }
          output = window.moduleOutput[name](this.microvm.context.global, args);
        //now clean up the context
        (function(window) {
          var taint = {};
          for (var key in window) taint[key] = key;
          for (var key in window.cache) delete taint[key];
          for (var key in taint) delete window[key];
        })(window);
        
        return output
      }
    } catch (error) {
      err = error;
      if (err.stack != null) {
        line = err.stack.split(".js:");
        file = line[0];
        line = line[1];
        if ((file != null) && (line != null)) {
          line = line.split(":")[0];
          if (file.lastIndexOf("(") >= 0) {
            file = file.substring(file.lastIndexOf("(") + 1);
          }
          if (file.lastIndexOf("@") >= 0) {
            file = file.substring(file.lastIndexOf("@") + 1);
          }
          this.microvm.context.location = {
            token: {
              line: line,
              file: file,
              column: 0
            }
          };
        }
      }
      throw err.message;
    }
  }

  toString(obj) {
    if (obj != null) {
      return obj.toString();
    } else {
      return "null";
    }
  }

};
