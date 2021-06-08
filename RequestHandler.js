const fs =  require('fs');
exports.RequestHandler = function(app, dir){
    let moduleHandler = {};
    fs.readdirSync(dir + '/RequestHandler').filter(file => file != 'index.js').forEach((file)=>{
        
        let filename = file.split('.')[0];
        try {
            let mod = require(dir + '/RequestHandler/' + filename);
            moduleHandler = Object.assign(moduleHandler, mod); 
        }
        catch(e){
            logger.error("При подключении обработчика ", filename, " произошла ошибка: ", e);
            throw new Error(e);            
        }
    });
    
    return moduleHandler;    
}