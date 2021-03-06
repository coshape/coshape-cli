# Coshape CLI Tool

An experimental toolkit to create web based 3D designs, convert and visualize CAD data and access the coshape CAD web services for Maker projects.
Checkout [coshape.io](https://coshape.io) for the [tutorial](https://coshape.io/documentation/main_file/) and [examples](https://coshape.io/coshape_cli/).

## Features
- create customizable 3D modeling frontends
- define assemblies of parametrized 3D models in [YAML](http://yaml.org/) based project file
- integrated SCAD (OpenJscad), STL and SVG for 3D printers and Laser cutters
- create and manage customizable projects
- live server and static build

## Change log

- 2021-03-05 Implemented cascading project inclusion, (cf. example boxed model rocket)

- 2021-01-03 Added indication of model size to the 3D view

- 2020-12-13 Added clone function and updated Quadrocopter example to use it.

![screenshot_quadrocopter]( doc/screenshot_quadrocopter.png?raw=true )

- 2020-11-11 Updated GUI to allow for simple TRS and parameter changes per component (cf. screenshot)

![screenshot_editing]( doc/screenshot_table_edit.png?raw=true )


## Global Installation

Install the toolkit globally for easy access. Note that this will usually require root permission (sudo).

``` bash
$ npm install coshape -g
```

The toolkit is now available in the terminal as coshape command.
``` bash
$ coshape
```

## Local Installation

The toolkit can also be installed without root permissions.

To install the toolkit locally, create a new directory e.g. 'coshape-tools' and run npm.

``` bash
$ npm install coshape
```

Access the toolkit from the current working directory like this.
``` bash
$ ./node_modules/coshape/bin/coshape.js
```

## Source Code

The source code is on [GitHub](https://github.com/coshape/coshape-cli) and can be checked out like this.

``` bash
$ git clone https://github.com/coshape/coshape-cli.git/
```

Change into the project directory, install the dependencies with npm and the toolkit is ready to be used.

``` bash
$ npm install
```

Access the toolkit from the current working directory like this.
``` bash
$ ./node_modules/coshape/bin/coshape.js
```

## Quick Start

**Create a new workspace to manage several projects**

Create a new directory for your customizer projects. Change into the new directory and initialize the workspace.

``` bash
$ coshape init
```

**Create a new project**

Creates a new project folder and fills it with a dummy customizer for testing.

``` bash
$ coshape new my-awesome-project
$ cd my-awesome-project
```


**test your projects in a live server**

Change into the customizer project folder or into a workspace and start the live server.

``` bash
$ coshape run
```

Open a browser and go to the following url.
```
http://localhost:3000
```

Edit the customizer source code files and the server will automatically update the web application and reload the browser window.

Have a look into our [Tutorial](https://coshape.io/documentation/main_file/)

**Examples**

Download or checkout the [examples](https://github.com/coshape/coshape-cli/tree/master/examples), change the directory into the examples directory or
project directory, run the live server and start hacking with your favorite IDE.

**Generate static files**

``` bash
$ coshape build
```



**Have fun!**

![screenshot]( doc/screenshot_table.png?raw=true )


## License

MIT
