const {GetAppAccessRole} = require(doc_root + '/lib/srv/common');
let crypto = require(doc_root + '/db/crypto');
module.exports.Edit = async function Edit(req, resp){
    
    try{
        if(req.method !== 'POST') throw new Error('Нет доступа');
        let user_id = null;
        if(req.tokenPayload != null) user_id = req.tokenPayload.id;        
        else throw config.errors.sessionClose;

        let Role = await GetAppAccessRole('users', user_id, req.tokenPayload.user_apps);
        if (Role <= 0 || Role == 100)  throw config.errors.forbidden;

        let ID = req.body.id;
        let B = 0;
        
        if ((req.body.user_is_blocked == '1') || (req.body.user_is_blocked == 'true') || (req.body.user_is_blocked == 'on') || (req.body.user_is_blocked == 'yes'))  B = 1;
        if (req.body.user_name.length < 3) throw new Error('Имя пользователя должно быть не менее 3 символов');
        
        // Проверяем сочетание параметров и прав доступа
        let validateQuery = 'select * from public.user_validate_edit($1, $2, $3, $4)';

        let querySerialize = [
            ID == "" ? null : ID,
            user_id,
            req.body.base_org_id.length > 0 ? req.body.base_org_id : null,
            req.body.base_level.length > 0 ? req.body.base_level : null,          
        ];        

        let client = null, validateRes = null;
        client = await db.connect();
        try{      
            validateRes = await client.query(validateQuery, querySerialize);   
        }
        finally{
            client.release();   
        }
        
        querySerialize = [];
        
        if(validateRes.rows[0].error_text != null){
            throw new Error(validateRes.rows[0].error_text);
        }

        // Валидация прошла успешно, начинаем записывать.
        
        let r = null;
        let editQuery = "";
        
        if(ID === ""){
            editQuery = `insert into public.USERS (USER_NAME, USER_TITLE, IS_BLOCKED, USER_IDENTITY, BASE_ORG, BASE_LEVEL ${req.body.user_password !=="" ? ", USER_PASSWORD":"" })
            values ($1, $2, $3, $4, $5, $6 ${req.body.user_password !==""? ", $7":"" } ) 
            returning ID`;
        }else{
            editQuery = `update public.USERS set USER_NAME = $1, USER_TITLE = $2, IS_BLOCKED = $3, USER_IDENTITY = $4, BASE_ORG = $5,BASE_LEVEL = $6 ${req.body.user_password !==""? ", USER_PASSWORD = $8" : "" } 
            where ID = $7`;
        }

        let pswd = null;
        if(req.body.user_password.length > 1) pswd = crypto.md5(req.body.user_password);

        querySerialize = [
            req.body.user_name,
            req.body.user_title,
            B,
            req.body.user_identity,
            req.body.base_org_id.length > 0 ? req.body.base_org_id : null,
            req.body.base_level || 999
        ];

        if(req.body.id !=="") querySerialize.push(req.body.id);
        if(pswd !== null) querySerialize.push(pswd);       
        
        client = await db.connect();
        try{            
            await client.query('BEGIN');
            //Добавляем или обновляем пользователя
            r = await client.query(editQuery, querySerialize);  
            querySerialize = [];
            if(r.rows.length > 0) ID = r.rows[0].id;
            // Если есть id продолжаем
            if(ID != "" || ID != null) {
                // Сбрасываем роли пользователя
                let rest = await client.query('select * from public.USER_ROLES_RESET($1)', [ID]);
                if(typeof req.body.user_role !== "undefined"){
                    let roles = null;    
                    let user_role = [];
                    if(typeof req.body.user_role === "string") user_role.push(req.body.user_role);
                    else user_role = req.body.user_role;
                    for(let i=0; i < user_role.length; i++){
                        roles = null;       
                        querySerialize = [
                            ID,
                            user_role[i],
                            parseInt(req.body['app.' + user_role[i]])                
                        ];                        
                        roles = await client.query('select * from public.USER_ROLES_APPLY($1, $2, $3)', querySerialize);         
                    } 
                }

            }else{
                throw new Error("Нет идентификатора пользователя");
            }
            
            await client.query('COMMIT');       
        }catch(err){
            await client.query('ROLLBACK');
            throw new Error(err);
        }finally{
            client.release();
        } 
        resp.json({"id" : ID});
    }catch(e){
        logger.error('# Ошибка при сохранении данных', e.stack);
        return resp.status(500).json({errorno: e.code || 500, text: e.text || e.message});
    }
}