function MyApp() {
	// Set up your app
	this.listOfStuff = [
        { name: "First" },
        { name: "Second" },
        { name: "Third" }
	];
}

MyApp.prototype = {};

MyApp.prototype.removeItem = function (name) {
	this.listOfStuff = this.listOfStuff.filter(i => i.name != name);
};

MyApp.prototype.addItem = function (btnData, formData) {
	this.listOfStuff.push({ name: formData.name });
	this.listOfStuff = this.listOfStuff;
};