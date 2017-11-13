# Coshape CLI Tool

A toolkit to create web based 3D designs, convert and visualize CAD data and access the coshape CAD web services for Maker projects.
Checkout [coshape.io](https://coshape.io) to get an idea how it will look like.

## Features
- create customizable 3D modeling frontends
- define assemblies of parametrized 3D models in [YAML](http://yaml.org/) based project file
- integrated SCAD, STL and SVG for 3D printers and Laser cutters
- create and manage customizable projects
- live server and static build

## Installation

``` bash
$ npm install coshape -g
```


## Quick Start

**Create a new project**

``` bash
$ coshape new my-awesome-project
$ cd my-awesome-project
```

**test your projects in a live server**

``` bash
$ coshape run
```

**Generate static files**

``` bash
$ coshape build
```

**Have fun!**

![screenshot](https://github.com/coshape/coshape-cli/doc/screenshot_table.png)


## License

MIT
