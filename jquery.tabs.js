String.prototype.qualified = function () {
    return this.replace(/\W+/g, '');
};

/************************************************************************************************************************** 
* TabSwitcher Class (rely on jQuery, EventBox)
* parameter for selector {container, heads, selectedClass, [optional]getBody[function(tabName)]}
* optional parameter for ajax {beforeSend, complete, error, success }, the same as parameter of jQuery.ajax()
*/
function TabSwitcher(selector, ajax) {
    // Call the parent constructor
    EventBox.call(this);
    selector.getHead = function (tabName) {
        return $(selector.heads).filter(function () { return $(this).qualifiedName() == tabName; });
    };
    if (!selector.getBody) {
        selector.prefix = selector.container.words().join('_');
        selector.getBody = function (tabName) { return $('#{0}_{1}'.format(selector.prefix, tabName)); };
    }

    //=============================PRIVATE FUNCTIONS=============================
    var $this = this,
        fn = {
            clickTab: function (curTab, callback) {
                var curTabUrl = curTab.getUrl();
                if (!curTabUrl) return;
                var preTab = curTab.siblings('.' + selector.selectedClass),
                    curTabArg = {
                        head: curTab,
                        name: curTab.qualifiedName(),
                        url: curTabUrl
                    },
                    preTabArg = {
                        head: preTab,
                        name: preTab.qualifiedName(),
                        url: preTab.getUrl()
                    };
                curTab.addClass(selector.selectedClass);
                preTab.removeClass(selector.selectedClass);
                fn.switchTabContent(curTabArg, preTabArg, callback);
            },
            switchTabContent: function (curTab, preTab, callback) {
                curTab.body = selector.getBody(curTab.name);
                preTab.body = selector.getBody(preTab.name);
                var eventArg = { curTab: curTab, preTab: preTab };
                if (curTab.body.length == 0 || (!selector.prefix && !$.trim(curTab.body.html()))) {
                    fn.loadTab(curTab, function (html, status, jqXhr) {
                        eventArg.data = html;
                        eventArg.status = status;
                        eventArg.jqXhr = jqXhr;
                        curTab.body = selector.getBody(curTab.name);
                        fn.triggerSwitchEvents(eventArg, callback);
                    });
                    return;
                }
                fn.triggerSwitchEvents(eventArg, callback);
            },
            reloadTabContent: function (curTab, callback) {
                curTab.body = selector.getBody(curTab.name);
                var eventArg = { curTab: curTab };
                fn.loadTab(curTab, function (html, status, jqXhr) {
                    eventArg.data = html;
                    eventArg.status = status;
                    eventArg.jqXhr = jqXhr;
                    curTab.body = selector.getBody(curTab.name);
                    fn.triggerSwitchEvents(eventArg, callback);
                });
            },
            triggerSwitchEvents: function (event, callback) {
                if (event.preTab && event.preTab.name) {
                    event.preTab.body.mdcHide();
                    $this.trigger(event.preTab.name, 'hide', event);
                }
                event.curTab.body.mdcShow();
                if (!event.curTab.body.data('initialized')) {
                    $this.trigger(event.curTab.name, 'init', event);
                    event.curTab.body.data('initialized', true);
                    $this.trigger($this, 'load', event);
                }
                $this.trigger(event.curTab.name, 'show', event);
                if (event.preTab && event.preTab.name) $this.trigger($this, 'switch', event);
                if (callback) callback.call(null, event);
            },
            loadTab: function (tab, initCallback) {
                var curAjax = $.extend({ tab: tab, url: tab.url, type: 'GET', dataType: 'html' }, ajax);
                curAjax.success = function (html) {
                    var callDefaultAppend = true;
                    if (ajax.success) {
                        var ret = ajax.success.apply(curAjax, arguments);
                        if (callDefaultAppend = (ret && typeof ret === 'string')) html = ret;
                    }
                    if (callDefaultAppend && typeof html === 'string') {
                        if (selector.prefix) html = '<div id="{0}_{1}">{2}</div>'.format(selector.prefix, tab.name, html);
                        if (tab.reload) {
                            tab.body.replaceWith(html);
                        } else {
                            var container = tab.body.length == 0 ? $(selector.container) : tab.body;
                            container.append(html);
                        }
                    }
                    initCallback.apply(null, arguments);
                };
                $.ajax(curAjax);
            }
        };

    if (!selector.btnNext) {
        $(selector.heads).click(function () {
            fn.clickTab($(this));
        });
    }

    //=============================PUBLIC FUNCTIONS=============================
    //register a tab object which could response on tab switch events, such as [init, show, hide]
    this.register = function (tabName, tabObject) {
        $.extend(tabObject, {
            name: tabName.qualified(),
            head: function () { return selector.getHead(this.name); },
            body: function () { return selector.getBody(this.name); }
        });
        EventBox.prototype.register.call(this, tabObject.name, tabObject);
    };

    //common events that occurs when tabs are switched
    this.onSwitch = function (callback/*fn(event)*/) {
        this.bind('switch', callback);
    };

    //common events that occurs when a tab is first loaded or reloaded
    this.onLoad = function (callback/*fn(event)*/) {
        this.bind('load', callback);
    };

    //action, reload current tab with a specified URL and callback()
    this.reload = function (url, callback/*fn(event)*/) {
        var tabHead = this.selectedTab();
        var curTab = {
            'head': tabHead,
            'name': tabHead.qualifiedName(),
            'reload': true,
            'url': url
        };
        fn.reloadTabContent(curTab, callback);
    };

    //get currently seletected tab header(jQuery object)
    this.selectedTab = function () {
        return $(selector.heads).filter(function () {
            return $(this).hasClass(selector.selectedClass);
        });
    };

    //click a tab
    this.clickTab = function (tabName, callback/*fn(event)*/) {
        var curTab = selector.getHead(tabName.qualified());
        if (curTab.length > 0) fn.clickTab(curTab, callback);
    };

    //get specified tab header(jQuery object)
    this.tabHead = function (tabName) {
        return selector.getHead(tabName.qualified());
    };

    //get specified tab body(jQuery object)
    this.tabBody = function (tabName) {
        return selector.getBody(tabName.qualified());
    };
}

// inherit from EventBox
TabSwitcher.prototype = new EventBox();
TabSwitcher.prototype.constructor = TabSwitcher;

//=============================jquery shortcut for TabSwitcher constructor=============================
(function ($) {

    $.fn.qualifiedName = function () {
        var name = this.data('name') || this.text();
        return name.qualified();
    };

    $.fn.getUrl = function () {
        return this.data('src') || this.data('href') || this.data('url') || this.attr('src') || this.attr('href');
    };

    //parameter for selector {heads, selectedClass, [optional]getBody[function(tabName)]}
    $.fn.tabs = function (selector, ajax) {
        var m = $.extend({}, selector, {
            container: this.selector,
            heads: this.find(selector.heads).selector
        });
        ajax = $.extend({
            beforeSend: function () { $(m.container).updateOn(); },
            complete: function (jqXhr, textStatus) { if (textStatus == 'success') $(m.container).cancelUpdatingOn(); },
            error: function (jqXhr) { $(m.container).showUpdateError(jqXhr.statusText); }
        }, ajax);
        return new TabSwitcher(m, ajax);
    };

})(jQuery);
