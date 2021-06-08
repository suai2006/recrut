"use strict";

let main = require("./main");
let login = require("./login");
let fias = require("./main/fias");

let apps = require(doc_root + '/apps');
module.exports = async function(app, logger) { 

    // Если не объявлено приложения для корневой страницы - отдаем по-умолчанию
    if(indexRouterApp == null) {
        main.defaultPage("/", app, logger);
    }    

    login.loginHandler("/api/login", app, logger);
    login.registerHandler("/api/register", app, logger);
    login.activateHandler("/api/activate", app, logger);
    login.logoutHandler("/api/logout", app, logger);
    // captcha.getCaptcha("/api/captcha", app, logger);

    app.get("/login", function(req, res, next) {
        
        if(req.tokenPayload === null){
            res.render("loginPage", {title: "Страница авторизации"});
        }
        else {
            res.redirect(302, "/");
        }
        
    });

    // Работа с адресным справочником в старом и новом формате
    fias.fiasHandler("/api/address", app, logger);
    fias.fiasHandler("/webservice/app.address/execute", app, logger);
   
    //=====================================================================================================
    // Обработчики приложений apps/.../server
    // Внутри каждого делается свой index.js, который обрабатывает внутреннюю структура маршрутизации
    await apps(app);
    
    app.use(function(req, res, next) {
        let err = new Error("Page Not Found");
        next(err);
    });
};