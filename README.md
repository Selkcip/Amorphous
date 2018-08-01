I decided to write my own framework (https://xkcd.com/927/) not because I thought I could do better, but I thought it would be a fun project.
It's called Amorphous and I was wrong.

Instead of using a preprocessor to bind to the app's html, Amorphous takes advantage of Chrome's support for custom html elements to create an extensible set of views that can be used to interact with and display an app's data. 

The basic usage is:
```
js:
function MyApp(){
    // Set up your app
    this.listOfStuff = [
        {name: "First"},
        {name: "Second"},
        {name: "Third"}
    ];
}

html:
<am-app data-app="MyApp">
    <div>Here's a list of things</div>
    <am-repeat data-name="listOfStuff">
        <!-- The contents of this element will be treated as a template -->
        <am-text data-name="name">This text will be replaced with the value of name for each entry in the list.</am-text>
    </am-repeat>
</am-app>

rough output:
Here's a list of things
First
Second
Third
```

There isn't really data manipulation support built in so you have to define functions in your app for that and then call them from button elements. The app view watches the top level properties of the app and updates itself and its children when one changes.

Of course being dependent on custom elements means that in any other browser it'll just be a static page with the initial values. This could potentially be fixed with a shim to add custom element support.
