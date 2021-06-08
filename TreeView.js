class dgTree {

    constructor(container, options = {}) {

        let defaultOptions = {
            fontName: '"Segoe UI",Tahoma,Helvetica,Arial,sans-serif',
            textSize: "14",
            linesColor: "rgba(0,0,0,0.5)",
            colorEven: "rgba(0,0,0,0.05)",
            colorHovered: "rgba(0,0,0,0.1)",
            colorActive: "#2185d0",
            textColor: "#000000de",
            textColorActive: "white",
            textColorError: "#9f3a38",
            paddingX: 0.8,
            paddingY: 0.4,
            scrollSize: 10,
            treeBoxSize: 8,
            imageSize: 20
        };

        this.container = container;
        $(this.container).css({position: "relative"});

        this.root = new treeNode(this, null, "", "");
        this.visibleNodes = [];
        this.selectedNode = null;
        this.hoveredNode = null;
        this.options = Object.assign({}, options, defaultOptions);
        this.updating = 0; // Флаг блокировки обновлений
        this.onExpand = null;     
        this.onCollapse = null;    
        this.onContextmenu = null;
        this.onSelect = null;
        this.treeRequest = null; // Блокировка кликов при выполнении запроса
        this.onWheelScroll = null;
        this.onMouseScroll = null;

        this.canvas = document.createElement("canvas");
        
        this.canvas.classList.add("dg-tree");
        this.canvas.onmousemove = (e) => { this.mouseMove(e); };
        this.canvas.onmouseleave = (e) => { this.mouseLeave(e); };
        this.canvas.onclick = (e) => { this.mouseClick(e); };
        this.canvas.onwheel = (e) =>{this.wheel(e);};
        this.canvas.oncontextmenu = (e) =>{this.mouseContextmenu(e);};
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext("2d");     

        this.fontHeight = Utils.textHeight(this.options.textSize, this.options.fontName, "W");
        this.fontWidth = this.ctx.measureText("W").width;
        this.itemPaddingX = Math.floor(this.fontWidth * this.options.paddingX);
        this.itemPaddingY = Math.floor(this.fontHeight * this.options.paddingY);
        this.itemHeight = this.fontHeight + 2 * this.itemPaddingY;
        this.size = {width: 0, height: 0};
        
        this.scrollDelta = 0;
        
        this.resize();
        this.globalResize = null;
        
    }

    beginUpdate() {
        this.updating += 1;
    }

    endUpdate() {
        if(this.updating > 0) {
            this.updating -= 1;
            if(this.updating === 0) this.paint();
        }
    }

    remove() {         
        this.el.remove();
        this.el = null;
    }
    
    drop(){        
        if(this.visibleNodes.length > 0){
            for(let j = 0; j < this.visibleNodes.length; j++){
                this.visibleNodes[j].collapse();
                this.visibleNodes[j].selected = false;
            }
        }
    }
    
    clear(){
       if(this.visibleNodes.length > 0){
            for(let j = 0; j < this.visibleNodes.length; j++){
                this.visibleNodes[j].collapse();
                this.visibleNodes[j].selected = false;
            }
        } 
        this.selectedNode = null;
        this.visibleNodes = [];
        this.paint();
    }

    resize() {

        let s = {width: Math.floor(this.container.offsetWidth - 2), height: Math.floor(this.container.offsetHeight)};

        if(this.size.width != s.width || this.size.height != s.height) {
            this.size = s;
            this.canvas.setAttribute("width", this.size.width);
            this.canvas.setAttribute("height", this.size.height);

            this.paint();
        }

    }

    paint() {

        if(this.updating) return;
   
        this.ctx.save();
        this.ctx.translate(0, 0);

        this.ctx.clearRect(0, 0, this.size.width, this.size.height);
        this.ctx.translate(0.5, 0.5);
        
        this.scrollDelta = this.scrollBar ? this.scrollBar.scrollTop : 0;     
        let r = {left: 0, top: 0, width: this.size.width, height: this.itemHeight, scroll: this.scrollDelta};
        
        for(let j = 0; j < this.visibleNodes.length; j++) {
            this.visibleNodes[j].paint(j, r); 
            r.top = r.top + this.itemHeight;
        }
        
        if(this.visibleNodes.length*this.itemHeight > this.canvas.clientHeight) {
            this.scrollBarPaint(true);
        } 
        else {
            this.scrollBarPaint(false);
        }

        this.ctx.restore();

    }
    

    setMousePos(event) {
        let canvasTop = Math.floor(this.canvas.getBoundingClientRect().top)-this.scrollDelta;
        let index = Math.floor((event.clientY-canvasTop) / this.itemHeight);
        let el = null;
        if(index >= 0 && index < this.visibleNodes.length) el = this.visibleNodes[index];
        return el;

    }

    mouseMove(event) {

        let el = this.setMousePos(event);

        if(el != this.hoveredNode) {
            this.hoveredNode = el;
            this.paint();
        }
    
    }

    mouseLeave(event) {

        if(null != this.hoveredNode) {
            this.hoveredNode = null;
            this.paint();
        }

    }   
    
    wheel(event) { 
        
        if(typeof this.scrollBar === "undefined") return;
        this.hoveredNode = null;
        if(event.deltaY > 0){
             this.scrollBar.scrollTop = this.scrollBar.scrollTop + this.itemHeight;
         }
         else if(event.deltaY < 0){
             this.scrollBar.scrollTop = this.scrollBar.scrollTop - this.itemHeight;
         }
    }
    
    
    scrollBarPaint(flag){        
        if(flag) {
            this.scrollBar = $(this.container).find(".tv-sb");
            
            if(this.scrollBar.length == 0){
                $(this.container).append("<div class='tv-sb'><div class='slider'></div></div>");
                this.scrollBar = $(this.container).find(".tv-sb");
                // чтоб не выносить в css
                this.scrollBar.css({
                    "position": "absolute",
                    "right": "0",
                    "top": "0",
                    "bottom": "0",
                    "overflow-y": "scroll",
                    "width": (this.getScrollBarWidth() + 1) + "px"
                });
            }        
            this.scrollBar = this.scrollBar.get(0);

            let slider = $(this.scrollBar).find(".slider");
            slider.height((this.visibleNodes.length + 1) * this.itemHeight); 

            // Создаем место для прокрутки чистим холст
            this.ctx.clearRect(this.canvas.width - this.scrollBar.offsetWidth - 2, -1, this.canvas.width, this.canvas.height);
            this.scrollBar.onscroll = (e) => this.paint();

        }
        else {
            $(this.scrollBar).remove();
            delete this.scrollBar;
        }
    }

    getScrollBarWidth() {

        var inner = document.createElement('p');
        inner.style.width = "100%";
        inner.style.height = "200px";

        var outer = document.createElement('div');
        outer.style.position = "absolute";
        outer.style.top = "0px";
        outer.style.left = "0px";
        outer.style.visibility = "hidden";
        outer.style.width = "200px";
        outer.style.height = "150px";
        outer.style.overflow = "hidden";
        outer.appendChild(inner);

        document.body.appendChild(outer);
        var w1 = inner.offsetWidth;
        outer.style.overflow = 'scroll';
        var w2 = inner.offsetWidth;
        if (w1 == w2) w2 = outer.clientWidth;

        document.body.removeChild(outer);

        return (w1 - w2);

    }

    deepEqual(a, b) {
        if (a === b) {
            return true;
        }

        if (a == null || typeof(a) != "object" ||
            b == null || typeof(b) != "object")
        {
            return false;
        }

        let propertiesInA = 0, propertiesInB = 0;
        for (let property in a) {
            propertiesInA += 1;
        }
        for (let property in b) {
            propertiesInB += 1;
            if (!(property in a) || !this.deepEqual(a[property], b[property])) {
                return false;        
            }
        }        
        return propertiesInA == propertiesInB;
    }
    
    mouseClick(event) {
        
        if(this.treeRequest !== null) return;
        let el = this.setMousePos(event);
        if(el === null) return;
        if(el.isTmpNode) return;
        
        let canvasleft = Math.floor(this.canvas.getBoundingClientRect().left);
        
        if(this.selectedNode!=null && el != this.selectedNode && this.selectedNode.canClose === false){
            if(this.selectedNode.unblock != null){
                this.selectedNode.unblock(this.selectedNode);
                return;
            }else{
                this.selectedNode.canClose = true;
            }
        }

        if(el != this.selectedNode && this.selectedNode != null){
            
            this.selectedNode.selected = false;
        } 
        
        this.hoveredNode = el; 
        this.selectedNode = el;
             
        if(el != null) {
            if(!el.selected){
                if(el.tree.onSelect !== null) {
                    // Раскрытие можно отменить                                 
                    if(!el.tree.onSelect(el)) return;           
                }
            }
            
            el.selected = true; 
           
           if(el.children.length > 0 && !el.expanded) {
                let iconX1 = el.level * this.options.imageSize, iconX2 = iconX1 + this.options.imageSize;
                if((event.clientX-canvasleft) >= iconX1 && (event.clientX-canvasleft) <= iconX2) el.expand();
                
            } 
            else if(el.children.length > 0 && el.expanded) {
                let iconX1 = el.level * this.options.imageSize, iconX2 = iconX1 + this.options.imageSize;
                if((event.clientX-canvasleft) >= iconX1 && (event.clientX-canvasleft) <= iconX2) el.collapse();
                
            } 
        }       
        
        this.paint();
    }
    
    mouseContextmenu(e){
        e.preventDefault();
        if(this.treeRequest !== null) return;         
        let el = this.setMousePos(e);
        if(el === null) return;
        if(el.isTmpNode) return;       
        if(this.selectedNode!=null && el != this.selectedNode && this.selectedNode.canClose === false){
            if(this.selectedNode.unblock != null){
                this.selectedNode.unblock();
                return;
            }
            else{
                this.selectedNode.canClose = true;
            }
        }
        if(el != this.selectedNode && this.selectedNode != null) this.selectedNode.selected = false;
        this.hoveredNode = el; 
        this.selectedNode = el;
        if(el != null) {
            if(!el.selected) {
                if(el.tree.onSelect !== null) {                    
                    if(!el.tree.onSelect(el)) return;           
                }
            }
            
            el.selected = true; 
            el.contextMenu(e);
            
        }
        else {
            
            if(this.onContextmenu !== null) {
                this.root.contextMenu(e);
                //if(!this.onContextmenu(this)) return;
            }
        }
        
        this.paint();
    }
    
    static image(type){
        if(type === "folder"){
            return "\uf07b";
        }
        else if(type === "request"){
            return "\uf1c0";
        }
        else if(type === "error"){
            return "\uf071";
        }
        
    }

}

class treeNode {

    constructor(tree, parent, caption, image, userData = null, level = -1) {

        this.tree = tree;
        this.parent = parent;
        this.level = level;
        this.children = [];
        this.expanded = false;
        this.selected = false;
        
        this.caption = caption;
        this.image = image;
        this.userData = userData;
        this.isTmpNode = false;
        this.nodeError = false;
        this.canClose = true;
        this.unblock = null;
    }

    addChild(caption, image = "", userData = null) {
        
        let node = new treeNode(this.tree, this, caption, image, userData, this.level + 1);
        
        this.children.push(node);
        
        // Корневые пункты всегда добавляем к числу выбранных, и всегда в самый конец
        if(this.parent == null) {            
            this.tree.visibleNodes.push(node);
        }
        
        // Остальные только если добавляем в развернутый узел родителя
        else if(this.expanded) {
            
            if(this.children[0] == null) this.children.splice(0, 1);
            if(this.children[0]!==null && this.children[0].isTmpNode){
                this.children[0].remove();
            }
            
            let index = this.tree.visibleNodes.indexOf(this);
            let childIndex = this.children.length;
            this.tree.visibleNodes.splice(index + childIndex, 0, node);
        }
        
        this.tree.paint();
        return node;

    }
    
    createFakeNode(){
        this.children.push(null);
        this.tree.paint();
    }

    updateNode(){
        this.tree.paint();
    }
    
    setTmpNode(type){
        if(type === "request") {
            this.addChild("Загружаем данные...", dgTree.image(type), {}).isTempNode(true);            
        }
        else if(type === "error"){
            this.addChild("Ошибка получения данных...", dgTree.image(type), {}).isTempNode(true).isError();
            let treeNodeWait = setTimeout(()=>{
                this.collapse();
                this.tree.treeRequest = null; 
                clearTimeout(treeNodeWait);
            },1000);
        }
    }
    
    isTempNode (flag){
        this.isTmpNode = flag;
        return this;
    }
    
    isError(){
        this.nodeError = true;
        this.tree.paint();
        return this;
    }   
 
    remove() {    
        if(this.parent != null) {
            if(this.expanded){
                this.collapse();
            }
            let p = this.parent.children.indexOf(this);
            if(p != -1) this.parent.children.splice(p, 1);
            let j = this.tree.visibleNodes.indexOf(this);
            if(j != -1) this.tree.visibleNodes.splice(j, 1); 
        }

    }

    expand() {
        if(this.expanded) return;    

        // Проверить, что все родители раскрыты
        // ...

        if(this.tree.onExpand !== null) {           
            // Раскрытие можно отменить      
            if(!this.tree.onExpand(this)) return;           
        }
        
        if(this.children.length == 0) return;        
        if(this.children.length === 1 && this.children[0] === null) return; 
        
        // Добавляем раскрывшиеся дочерние элементы
        if(this.children.length > 0) {
            let index = this.tree.visibleNodes.indexOf(this), i = 1;
            for(let child of this.children) {
                this.tree.visibleNodes.splice(index + i, 0, child);
                i++;
            }
        }
        
        this.expanded = true;
        this.tree.paint();        
    }

    collapse(r = false) {        
        
        if(this.children.length == 0) return;
        
        if(!this.expanded) return;

        // this.children = [];
        if(this.tree.onCollapse !== null) {            
            // Свертывание можно отменить
            if(!this.tree.onCollapse(this)) return;
        }        

        this.expanded = false;        
        
        for(let i = 0; i < this.children.length; i++){ 
            let p = this.tree.visibleNodes.indexOf(this.children[i]);            
            if(this.children[i]!==null && this.children[i].expanded){
               this.children[i].collapse(true);
            }
            if(p >= 0) this.tree.visibleNodes.splice(p, 1);                    
        }
        
        if(r == false) this.tree.paint();

    }
    
    contextMenu(e){
        if(this.tree.onContextmenu !== null) {            
            // Свертывание можно отменить
            if(this.isTmpNode) return;
            if(!this.tree.onContextmenu(this,e)) return;
        }
    }

    select(state = true) {
        if(this.isTmpNode) return;
        if(this.selected === state) return;

        if(this.tree.selectedNode !== null) this.tree.selectedNode.selected = false;
        this.selected = state;
        this.tree.selectedNode = state ? this : null;

        this.tree.paint();

    }

    paint(index, r) { 

        // Не рисуем ничего, если вышли за пределы видимой части
        //if((r.top - r.scroll) > this.tree.size.height) return;
        //if((r.top - r.scroll + this.tree.itemHeight) < 0) return; 
        
        let ctx = this.tree.ctx;
        let pIndex = this.parent.children.indexOf(this), isLast = pIndex == this.parent.children.length - 1;
        if((index % 2) && (this.tree.options.colorEven.length > 0) && !this.selected) {
            ctx.fillStyle = this.tree.options.colorEven;
            ctx.fillRect(r.left, r.top - r.scroll, r.width, r.height);
        }

        if(this.selected) {
            ctx.fillStyle = this.tree.options.colorActive;
            ctx.fillRect(r.left, r.top - r.scroll, r.width, r.height);
        }
        if(this.tree.hoveredNode == this) {
            ctx.fillStyle = this.tree.options.colorHovered;
            ctx.fillRect(r.left, r.top - r.scroll, r.width, r.height);
        }
        
        ctx.strokeStyle = this.tree.options.linesColor;

        let lx = r.left + this.level * this.tree.options.imageSize;
        let tx = lx + (this.tree.options.imageSize - this.tree.options.treeBoxSize) / 2;
        let ly = r.top + (r.height - this.tree.options.treeBoxSize) / 2 - r.scroll;        
        
        // Рисуем +/- для элементов с дочерними элементами
        if(this.children.length > 0) {
            
            // Вертикальный участок соединительной линии

            ctx.beginPath();
            ctx.moveTo(tx, ly);
            ctx.lineTo(tx + this.tree.options.treeBoxSize, ly);
            ctx.lineTo(tx + this.tree.options.treeBoxSize, ly + this.tree.options.treeBoxSize);
            ctx.lineTo(tx, ly + this.tree.options.treeBoxSize);
            ctx.closePath();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(tx + 2, ly + this.tree.options.treeBoxSize / 2);
            ctx.lineTo(tx + this.tree.options.treeBoxSize - 2, ly + this.tree.options.treeBoxSize / 2);
            ctx.stroke();

            if(!this.expanded) {
                ctx.beginPath();
                ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, ly + 2);
                ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, ly + this.tree.options.treeBoxSize - 2);
                ctx.stroke();
            }

            // Вертикальные соединители
            ctx.beginPath();
            ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, r.top - r.scroll);
            ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, ly);
            ctx.stroke();

            if(!isLast) {
                ctx.beginPath();
                ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, ly + this.tree.options.treeBoxSize);
                ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, (r.top + r.height) - r.scroll);
                ctx.stroke();
            }
            // Дорисовываем вертикальный соединитель, если он был пропущен в предыдущих пунктах
            let p = this.parent.children.indexOf(this);            
            if(p > 0) {                
                let prevP = this.tree.visibleNodes.indexOf(this.parent.children[p - 1]);
                if(prevP < index - 1) {
                    ctx.beginPath();
                    ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, ((r.top - (index - prevP) * this.tree.itemHeight)+this.tree.itemHeight) - r.scroll);
                    ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, r.top - r.scroll);
                    ctx.stroke();
                }
            }

        }
        else {
            
            // Горизонтальный участок соединительной линии
            ctx.beginPath();
            ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, ly + this.tree.options.treeBoxSize / 2);
            ctx.lineTo(lx + this.tree.options.imageSize - 2, ly + this.tree.options.treeBoxSize / 2);
            ctx.stroke();

            // Вертикальные соединители
            ctx.beginPath();
            ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, r.top - r.scroll);
            ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, ly + this.tree.options.treeBoxSize / 2);
            ctx.stroke();

            if(!isLast) {
                ctx.beginPath();
                ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, ly + this.tree.options.treeBoxSize / 2);
                ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, (r.top + r.height) - r.scroll);
                ctx.stroke();
            }
            // Дорисовываем вертикальный соединитель, если он был пропущен в предыдущих пунктах
            let p = this.parent.children.indexOf(this);            
            if(p > 0) {                
                let prevP = this.tree.visibleNodes.indexOf(this.parent.children[p - 1]);
                if(prevP < index - 1) {
                    ctx.beginPath();
                    ctx.moveTo(tx + this.tree.options.treeBoxSize / 2, (r.top - (index - prevP) * this.tree.itemHeight) - r.scroll);
                    ctx.lineTo(tx + this.tree.options.treeBoxSize / 2, r.top - r.scroll);
                    ctx.stroke();
                }
            }
        }       
        
        lx += this.tree.options.imageSize;

        ctx.fillStyle = this.selected ? this.tree.options.textColorActive : this.tree.options.textColor;
        if(this.nodeError) ctx.fillStyle =  this.tree.options.textColorError;
        
        // Рисуем пиктограмму        
        if(this.image !== "") {
            ctx.beginPath();
            ctx.font = this.tree.options.textSize + "px " + "Icons";
            ctx.fillText(this.image, lx, (r.top + r.height - this.tree.itemPaddingY) - r.scroll);
            ctx.closePath();
            ctx.stroke();
            lx += this.tree.options.imageSize;
        }       

        // Рисуем заголовок, при выборе цвет инвертируем
        if(this.userData.color) {
            ctx.fillStyle = "#" + this.toHex(+this.userData.color, this.selected);
        }
        ctx.beginPath();
        ctx.font = this.tree.options.textSize + "px " + this.tree.options.fontName;
        ctx.fillText(this.caption, lx, (r.top + r.height - this.tree.itemPaddingY) - r.scroll);
        ctx.closePath();
        
    }

    toHex(n, invert) {

        let h = "0123456789abcdef";

        // if(invert) n = ~n;
        // if(invert) return (n ^ 0xFFFFFF | 0x1000000).toString(16).substr(1);
        if(invert) return "ffff00";

        return h.substr((n >> 4) % 16, 1) + h.substr((n >> 0) % 16, 1) + h.substr((n >> 12) % 16, 1) + h.substr((n >> 8) % 16, 1) + h.substr((n >> 20) % 16, 1) + h.substr((n >> 16) % 16, 1);

    }

}
