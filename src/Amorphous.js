/**
* Wrap everything in a namespace
*/
var Amorphous = {};

/**
* Given a path, attempt to resolve it to a property
*/
Amorphous.resolvePath = function(path, root){
	var tokens = path.split('.');
	return tokens.reduce(function(cur, token){
		if (cur) {
			if (token.length == 0) {
				return cur;
			}
			return cur[token];
		}
		return null;
	}, root);
}

/**
* Mostly a dummy class for holding html templates for use by other elements
*/
Amorphous.Template = class extends HTMLElement {
}
customElements.define('am-template', Amorphous.Template);

/**
* The base view element. Initializes itself with references to the app view
* and its parent view.
*/
Amorphous.View = class extends HTMLElement {
	// Returns this view's cached data or updates it if it is null
	get data() {
		if (!this._data) {
			this.updateData();
		}
		return this._data;
	}

	// Sets up some properties
	constructor() {
		super();

		this.appContext = null;
		this.parentContext = null;
		this.dataName = null;
		this._data = null;
	}

	// Updates the data this view is currently referencing and caches it
	updateData() {
		this._data = null;
		if (this.parentContext && this.parentContext.data) {
			if (this.dataName) {
				this._data = this.parentContext.data[this.dataName];
			} else {
				this._data = this.parentContext.data;
			}
		}
	}

	// Initializes the view
	init() {
		// Get the name of the data the view should reference
		this.dataName = this.dataset.name;

		// Get the app and parent contexts by climbing up the hierarchy
		this.appContext = null;
		this.parentContext = null;
		for (var parent = this.parentNode; parent != null; parent = parent.parentNode) {
			if (!this.parentContext && parent instanceof Amorphous.View) {
				this.parentContext = parent;
			}
			if (parent instanceof Amorphous.App) {
				this.appContext = parent;
			}
		}

		// Initialize all of the child views
		var nodes = [];
		nodes.push.apply(nodes, this.children);
		while (nodes.length > 0) {
			var node = nodes.shift();
			if (node instanceof Amorphous.View) {
				node.init();
			} else {
				// Regular html element so add its children to the queue
				nodes.push.apply(nodes, node.children);
			}
		}
	}

	// Only meant to be called when the app data has changed
	update() {
		// clears the cached data so the next call to .data updates it
		this._data = null;
		
		// Update all of the child views
		var nodes = [];
		nodes.push.apply(nodes, this.children);
		while (nodes.length > 0) {
			var node = nodes.shift();
			if (node instanceof Amorphous.View) {
				node.update();
			} else {
				nodes.push.apply(nodes, node.children);
			}
		}
	}
}
customElements.define('am-view', Amorphous.View);

/**
* Top level view that initializes the given app. Replaces the app's fields
* with properties so that it can update its child views when a property changes.
* A less fancy digest cycle.
*/
Amorphous.App = class extends Amorphous.View {
	// We're at the top so just return the app
	get data() {
		return this.app;
	}

	// Set up some properties
	constructor() {
		super();

		this.app = null;
		this.appProperties = {};

		// The element's data set is empty until after the dom has loaded
		document.addEventListener("DOMContentLoaded", this.init.bind(this));
	}

	// Initialize the app
	init() {
		super.init();
		// Get the path for the app constructor
		if (this.dataset.app) {
			// Resolve the constructor
			var appInit = Amorphous.resolvePath(this.dataset.app, window);
			if (appInit) {
				// Instantiate the app
				this.app = new appInit();

				// Replace all of the app's fields with properties so that
				// we can listen for changes (wiretap the app)
				var propNames = Object.keys(this.app);
				for (var i = 0; i < propNames.length; i++) {
					// Pass this view's update function so that it's called
					// when a property is modified
					this.watch(propNames[i], this.update.bind(this));
				}

				this.update();
			}
		}
	}

	// super.update() updates all the child views
	update(propName, data) {
		super.update();
	}

	// Replaces fields with property getter/setter methods and adds the given
	// function as a watcher
	watch(propertyName, watcher) {
		var appProperties = this.appProperties;
		var property = appProperties[propertyName];
		// If we don't have a property, create one
		if (!property) {
			property = appProperties[propertyName] = {
				value: this.app[propertyName],
				watchers: []
			};
			Object.defineProperty(this.app, propertyName, {
				get: function () {
					return property.value;
				},
				set: function (value) {
					property.value = value;
					for (var w in property.watchers) {
						property.watchers[w](propertyName, value);
					}
				}
			});
		}
		// Add the watcher
		property.watchers.push(watcher);
	}
}
customElements.define('am-app', Amorphous.App);

/**
* Change the current context to the given data-path attribute. This allows you to
* reference data in another part of the app.
*/
Amorphous.Context = class extends Amorphous.View {
	constructor() {
		super();

		this.initDataName = null;
		this.initParentContext = null;
	}

	init() {
		super.init();

		this.initDataName = this.dataName;
		this.initParentContext = this.parentContext;

		// Find the target context for the given path
		var path = this.dataset.path;
		var lastTokenIndex = path.lastIndexOf('.');
		this.dataName = path.substring(lastTokenIndex);
		path = path.substring(0, lastTokenIndex);
		this.parentContext = Amorphous.resolvePath(path, this.appContext);
	}
}
customElements.define('am-context', Amorphous.Context);

/**
* An extension of the context view that uses its initial parent context's data as a
* field name on the new parent context's data
*/
Amorphous.Reference = class extends Amorphous.Context {
	updateData() {
		this._data = null;
		if (this.parentContext && this.parentContext.data && this.initParentContext && this.initParentContext.data) {
			//Get the data value from the intial parnentContext
			var initData = this.initParentContext.data;
			if(initData && this.initDataName){
				initData = initData[this.initDataName];
			}
			// use it as a key to get data from the new parent context
			this._data = initData ? this.parentContext.data[this.dataName][initData] : null;
		}
	}
}
customElements.define('am-reference', Amorphous.Reference);

/**
* Paginates the data that it references by returning a slice given a page size and current
* page index. Loops around, could be modified to clamp page index.
*/
Amorphous.Paginate = class extends Amorphous.View {
	// Get the current page index from the index context
	get pageIndex() {
		if (this.indexName && this.indexContext && this.indexContext.data) {
			var pageCount = Math.ceil(Object.keys(this._data).length / this.pageSize);
			var index = this.indexContext.data[this.indexName];
			// Loop the index around
			return (pageCount + (index % pageCount)) % pageCount;
		}
		return 0;
	}

	constructor() {
		super();

		this.pageSize = null;
	}

	updateData() {
		super.updateData();

		// Get the referenced data and return a slice of it
		var dataWhole = this._data;
		if (dataWhole) {
			var keys = Object.keys(dataWhole);
			if (keys.length > 0) {
				var dataSlice = {};
				var startIndex = this.pageIndex * this.pageSize;
				keys = keys.slice(startIndex, startIndex + this.pageSize);
				for (var i = 0; i < keys.length; i++) {
					dataSlice[keys[i]] = dataWhole[keys[i]];
				}
				this._data = dataSlice;
			}
		}
	}

	init() {
		super.init();

		this.pageSize = parseInt(this.dataset.pageSize);

		// Get the context for the page index
		var path = this.dataset.path;
		var lastTokenIndex = path.lastIndexOf('.');
		this.indexName = path.substring(lastTokenIndex);
		path = path.substring(0, lastTokenIndex);
		this.indexContext = Amorphous.resolvePath(path, this.appContext);
	}
}
customElements.define('am-paginate', Amorphous.Paginate);

/**
* Creates a template from its initial contents, then given an array or dictionary creates a
* copy for each entry
*/
Amorphous.Repeat = class extends Amorphous.View {
	constructor() {
		super();
		
		this.template = null;
	}

	init() {
		super.init();

		// Grab the template if there already is one or create a new one
		this.template = this.querySelector(":scope > am-template");
		if (!this.template) {
			this.template = document.createElement("am-template");
			while (this.children.length > 0) {
				this.template.appendChild(this.children[0]);
			}
			this.appendChild(this.template);
		}
	}

	update() {
		// Don't call super because we want to manually update the
		// repeat's children
		this._data = null;
		var data = this.data;

		if (data) {
			// Update existing items and remove ones that are not in the data set
			var existingItems = [];
			for (var i = this.children.length - 1; i >= 0; i--) {
				var child = this.children[i];
				if (child instanceof Amorphous.View) {
					var name = child.dataset.name;
					if (!data[name]) {
						this.removeChild(child);
					} else {
						existingItems.push(name);
						child.update();
					}
				}
			}

			// Add new items at the correct positions in the list
			var nodeIndex = 1; // Visible nodes start at 1 after the template
			for (var name in data) {
				if (existingItems.indexOf(name) == -1) {
					var view = document.createElement("am-view");
					view.dataset.name = name;
					for (var i = 0; i < this.template.children.length; i++) {
						view.appendChild(this.template.children[i].cloneNode(true));
					}
					this.appendChild(view);
					this.insertBefore(view, this.children[nodeIndex]);
					view.init();
					view.update();
				}
				nodeIndex++;
			}
		}
	}
}
customElements.define('am-repeat', Amorphous.Repeat);

/**
* Only visilble if its data reference is not null
*/
Amorphous.Conditional = class extends Amorphous.View {
	update() {
		super.update();

		this.classList.toggle("hidden", !this.data);
	}
}
customElements.define('am-conditional', Amorphous.Conditional);

/**
* Displays the data that it references
*/
Amorphous.Text = class extends Amorphous.View {
	constructor() {
		super();

		this.initText = null;
	}

	init() {
		super.init();
		this.initText = this.innerText;
	}

	update() {
		super.update();
		this.innerText = this.data || this.initText;
	}
}
customElements.define('am-text', Amorphous.Text);

/**
* Wraps an input and updates that inputs value to reflect the referenced data.
* Needs to be expanded for inputs other than text, textarea, checkbox
*/
Amorphous.Input = class extends Amorphous.View {
	constructor() {
		super();

		this.input = null;
	}

	init() {
		super.init();

		this.input = this.querySelector("input, textarea");
	}

	update() {
		super.update();
		if (this.input) {
			this.input.value = this.data;
			this.input.checked = this.data;
		}
	}
}
customElements.define('am-input', Amorphous.Input);

/**
* Creates a button that can call a function on the target context, passing in
* the current context's data and form data (if there is one)
*/
Amorphous.Button = class extends Amorphous.View {
	constructor() {
		super();

		this.targetContext = null;

		this.clickMethod = null;

		this.input = null;
	}

	// Build a dict from the form this input is wrapped in
	getFormData() {
		var formData = {};
		if (this.input.form) {
			var inputs = this.input.form.querySelectorAll("input, textarea");
			for (var input, i = 0; i < inputs.length; i++) {
				input = inputs[i];
				if (input.name) {
					formData[input.name] = input.type != "checkbox" ? input.value : input.checked;
				}
			}
		}
		return formData;
	}

	// Calls the specified function on the target context with the current
	// context and form data as params
	clickHandler() {
		if (this.clickMethod && this.targetContext && this.targetContext.data) {
			if (this.targetContext.data[this.clickMethod] instanceof Function) {
				this.targetContext.data[this.clickMethod](this.data, this.getFormData());
			}
		}
	}

	init() {
		super.init();
		this.targetContext = this.parentContext;

		// This allows calling a method in a different context while passing
		// the current context as a param
		var path = this.dataset.path;
		if (path != null) {
			this.targetContext = Amorphous.resolvePath(path, this.appContext);
		}

		// Add an input so we can grab the parent form if there is one
		this.input = this.querySelector("input");
		if (!this.input) {
			this.input = document.createElement("input");
			this.input.type = "hidden";
			this.appendChild(this.input);
		}

		// Register the click handler as an event listener
		this.clickMethod = this.dataset.click;
		if (this.clickMethod) {
			this.addEventListener("click", this.clickHandler.bind(this));
		}
	}
}
customElements.define('am-button', Amorphous.Button);

/**
* Toggles the active attribute and title text depending on the referenced data
*/
Amorphous.Icon = class extends Amorphous.View {
	constructor() {
		super();

		this.activeTitle = null;
		this.inactiveTitle = null;
	}

	init() {
		super.init();

		var stateTitles = this.title.split('|');
		this.activeTitle = stateTitles[0];
		this.inactiveTitle = stateTitles.length > 1 ? stateTitles[1] : stateTitles[0];
	}

	update() {
		super.update();
		if (this.data) {
			this.setAttribute("active", "");
			this.title = this.activeTitle;
		} else {
			this.removeAttribute("active");
			this.title = this.inactiveTitle;
		}
	}
}
customElements.define('am-icon', Amorphous.Icon);

/**
* Returns the plural or singular value depending on the count of the referenced data
*/
Amorphous.Pluralize = class extends Amorphous.View {
	update() {
		super.update();
		var data = this.data || 0;

		this.innerText = data + " " + (data == 1 ? this.dataset.singular : this.dataset.plural);
	}
}
customElements.define('am-pluralize', Amorphous.Pluralize);