const $ = (id, el) => (el || document).getElementById(id);

EventTarget.prototype.on = EventTarget.prototype.addEventListener;

Element.prototype.val = function (v) {
    if (v === undefined) return this.value;
    this.value = v;
    return this;
};

Element.prototype.css = function (prop, val) {
    this.style[prop] = val;
    return this;
};

Element.prototype.toggleCls = function (cls, force) {
    this.classList.toggle(cls, force);
    return this;
};

Element.prototype.addCls = function (cls) {
    this.classList.add(cls);
    return this;
};

Element.prototype.rmCls = function (cls) {
    this.classList.remove(cls);
    return this;
};

Element.prototype.show = function (disp) {
    this.style.display = disp || 'block';
    return this;
};

Element.prototype.hide = function () {
    this.style.display = 'none';
    return this;
};

NodeList.prototype.on = function (event, handler) {
    this.forEach(el => el.addEventListener(event, handler));
    return this;
};
