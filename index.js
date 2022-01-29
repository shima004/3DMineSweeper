window.addEventListener("DOMContentLoaded", init);

class Box {
  constructor(x, y, z, isBomb) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.isBomb = isBomb;
    this.adjacentBombs = 0;
    this.isOpen = false;
    this.isFlagged = false;
    this.mesh = null;
  }
}

class Canvas {
  initField() {
    this.x_size = document.getElementById("x").value > 0 ? document.getElementById("x").value : 5;
    this.y_size = document.getElementById("y").value > 0 ? document.getElementById("y").value : 5;
    this.z_size = document.getElementById("z").value > 0 ? document.getElementById("z").value : 5;
    this.bombs = document.getElementById("bombs").value;
    if (this.bombs >= this.x_size * this.y_size * this.z_size) {
      this.bombs = this.x_size * this.y_size * this.z_size - 1;
    }
    if (this.bombs < 0) {
      this.bombs = 1;
    }
    this.field = [];


    for (let i = 0; i < this.x_size; i++) {
      this.field[i] = [];
      for (let j = 0; j < this.y_size; j++) {
        this.field[i][j] = [];
        for (let k = 0; k < this.z_size; k++) {
          this.field[i][j][k] = new Box(i, j, k, false);
        }
      }
    }

    this.remainBox = this.x_size * this.y_size * this.z_size;

    this.wrap = new THREE.Group();
    this.scene.add(this.wrap);
    this.field.forEach((plane) => {
      plane.forEach((row) => {
        row.forEach((bomb) => {
          const geometry = new THREE.BoxGeometry(this.box_size, this.box_size, this.box_size);
          const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
          bomb.mesh = new THREE.Mesh(geometry, material);
          const icosahedronLine = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry), // 線を生成する元になるgeometry
            new THREE.LineBasicMaterial({ color: 0x0000FF }) // 線のmaterial
          );
          bomb.mesh.add(icosahedronLine);
          bomb.mesh.position.set(
            (this.x_size / 2 - bomb.x) * 100 - this.box_size / 2,
            (this.y_size / 2 - bomb.y) * 100 - this.box_size / 2,
            (this.z_size / 2 - bomb.z) * 100 - this.box_size / 2
          );
          bomb.mesh.name = `${bomb.x},${bomb.y},${bomb.z}`;
          this.wrap.add(bomb.mesh);
        });
      });
    });
  }

  setBombs() {
    // ランダムに爆弾を配置
    for (let i = 0; i < this.bombs; i++) {
      let x = Math.floor(Math.random() * this.x_size);
      let y = Math.floor(Math.random() * this.y_size);
      let z = Math.floor(Math.random() * this.z_size);
      if (this.field[x][y][z].isBomb || (x == this.firstClickBox.x && y == this.firstClickBox.y && z == this.firstClickBox.z)) {
        i--;
      } else {
        this.field[x][y][z].isBomb = true;
      }
    }
    // 周囲の爆弾数を各マスの構造体に設定
    for (let i = 0; i < this.x_size; i++) {
      for (let j = 0; j < this.y_size; j++) {
        for (let k = 0; k < this.z_size; k++) {
          if (!this.field[i][j][k].isBomb) {
            this.field[i][j][k].adjacentBombs = this.countAdjacentBombs(i, j, k);
          }
        }
      }
    }
  }

  countAdjacentBombs(x, y, z) {
    let count = 0;
    for (let i = x - 1; i <= x + 1 && i < this.x_size; i++) {
      for (let j = y - 1; j <= y + 1 && j < this.y_size; j++) {
        for (let k = z - 1; k <= z + 1 && k < this.z_size; k++) {
          if (i >= 0 && j >= 0 && k >= 0) {
            // 左右前後上下のマスに爆弾があるかどうか
            if (Math.abs(x - i) + Math.abs(y - j) + Math.abs(z - k) === 1) {
              if (this.field[i][j][k].isBomb) {
                count++;
              }
            }
          }
        }
      }
    }
    return count;
  }

  constructor() {
    this.box_size = 100;
    this.field = [];
    this.end_flag = false;
    this.prev_x = 0;
    this.prev_y = 0;
    this.firstClickBox = null;

    this.mouse = new THREE.Vector2(0, 0);

    this.container = document.getElementById("canvas");

    this.w = this.container.clientWidth;
    this.h = this.container.clientHeight;

    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(this.w, this.h);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.container.appendChild(this.renderer.domElement);

    this.fov = 60;
    this.fovRad = (this.fov / 2) * (Math.PI / 180);
    this.dist = this.h / 2 / Math.tan(this.fovRad);

    this.camera = new THREE.PerspectiveCamera(this.fov, this.w / this.h, 1, this.dist * 200);
    this.camera.position.z = this.dist;

    this.scene = new THREE.Scene();

    this.light = new THREE.AmbientLight(0xffffff, 1.0);

    this.scene.add(this.light);

    this.fontLoader = new THREE.FontLoader();

    this.initField();

    this.raycaster = new THREE.Raycaster();

    this.renderer.render(this.scene, this.camera);
    this.render();
  }

  render() {
    requestAnimationFrame(() => {
      this.render();
    });
    this.sec = performance.now() / 1000;

    this.renderer.render(this.scene, this.camera);
  }

  getIntersects(x, y) {
    const tmpMouse = new THREE.Vector2(((x - this.w / 2) / this.w) * 2, -((y - this.h / 2) / this.h) * 2);
    this.raycaster.setFromCamera(tmpMouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.wrap.children);
    return intersects;
  }

  openBox(x, y) {
    if (this.end_flag) {
      return;
    }
    const intersects = this.getIntersects(x, y);
    if (intersects.length > 0) {
      for (const item of intersects) {
        if (item.object.type === "Mesh") {
          let index = this.nameToIndex(item.object.name);
          let box = this.field[index.x][index.y][index.z];

          if (box.isFlagged) {
            break;
          }

          if (box.isBomb) {
            this.lose();
            break;
          } else {
            if (this.firstClickBox === null) {
              this.firstClickBox = new THREE.Vector3(index.x, index.y, index.z);
              this.setBombs();
            }
            box.isOpen = true;
            this.remainBox--;
            if (box.adjacentBombs === 0) {
              const obj = item.object;
              this.wrap.remove(obj);
              this.autoOpenBox(index.x, index.y, index.z);
            } else {
              this.displayNumber(index.x, index.y, index.z);
            }
            if (this.remainBox == this.bombs) {
              this.win();
            }
            break;
          }
        }
      }
    }
  }

  autoOpenBox(x, y, z) {
    for (let i = x - 1; i <= x + 1 && i < this.x_size; i++) {
      for (let j = y - 1; j <= y + 1 && j < this.y_size; j++) {
        for (let k = z - 1; k <= z + 1 && k < this.z_size; k++) {
          if (i >= 0 && j >= 0 && k >= 0) {
            if (Math.abs(x - i) + Math.abs(y - j) + Math.abs(z - k) === 1) {
              let box = this.field[i][j][k];
              if (!box.isBomb && !box.isOpen && !box.isFlagged) {
                box.isOpen = true;
                this.remainBox--;
                if (box.adjacentBombs == 0) {
                  // 周りに爆弾がない場合
                  this.autoOpenBox(i, j, k);
                  this.wrap.remove(box.mesh);
                } else {
                  // 周りに爆弾がある場合
                  this.displayNumber(i, j, k);
                }
              }
            }
          }
        }
      }
    }
  }

  displayNumber(x, y, z) {
    const Texture = this.createTexture("./img/" + this.field[x][y][z].adjacentBombs + ".png");
    const obj = this.field[x][y][z].mesh;
    this.createSprite(
      Texture,
      { x: this.box_size, y: this.box_size, z: this.box_size },
      { x: obj.position.x, y: obj.position.y, z: obj.position.z }
    );
    this.wrap.remove(this.field[x][y][z].mesh);
  }

  setFlag(x, y) {
    if (this.end_flag) {
      return;
    }
    const intersects = this.getIntersects(x, y);
    if (intersects.length > 0) {
      for (const item of intersects) {
        let index = this.nameToIndex(item.object.name);
        if (item.object.type === "Mesh") {
          let box = this.field[index.x][index.y][index.z];
          if (!box.isOpen) {
            box.isFlagged = !box.isFlagged;
            const obj = item.object;
            //change color
            if (box.isFlagged) {
              obj.material.color.set(0x0000ff);
              obj.children[0].material.color.set(0xff0000);
            } else {
              obj.material.color.set(0xffffff);
              obj.children[0].material.color.set(0x0000ff);
            }
            break;
          }
        }
      }
    }
  }

  restart() {
    this.scene.remove(this.wrap);
    document.getElementById("result").innerHTML = "";
    this.end_flag = false;
    this.firstClickBox = null;
    this.initField();
  }

  win() {
    document.getElementById("result").innerHTML = "You Win!";
    this.end_flag = true;
  }

  lose() {
    document.getElementById("result").innerHTML = "You Lose!";
    this.paintBombs();
    this.end_flag = true;
  }

  paintBombs() {
    for (let i = 0; i < this.x_size; i++) {
      for (let j = 0; j < this.y_size; j++) {
        for (let k = 0; k < this.z_size; k++) {
          if (this.field[i][j][k].isBomb) {
            const mesh = this.field[i][j][k].mesh;
            mesh.material.color.setHex(0xff0000);
            mesh.material.needsUpdate = true;
          } else {
            //　invisible
            const mesh = this.field[i][j][k].mesh;
            mesh.material.visible = false;
          }
        }
      }
    }
  }



  nameToIndex(name) {
    const index = name.split(",");
    return { x: parseInt(index[0]), y: parseInt(index[1]), z: parseInt(index[2]) };
  }

  createTexture(filePath) {
    return new THREE.TextureLoader().load(filePath);
  }

  createSprite(texture, scale, position) {
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(scale.x, scale.y, scale.z);
    sprite.position.set(position.x, position.y, position.z);
    this.wrap.add(sprite);
  }

  zoom(delta) {
    this.camera.position.z -= delta;
  }

  mouseMoved(x, y) {
    var tmp_x = x - this.w / 2;
    var tmp_y = -y + this.h / 2;
    this.wrap.rotation.x += (this.mouse.y - tmp_y) * 0.01;
    this.wrap.rotation.y -= (this.mouse.x - tmp_x) * 0.01;
    this.mouse.x = x - this.w / 2; // 原点を中心に持ってくる
    this.mouse.y = -y + this.h / 2; // 軸を反転して原点を中心に持ってくる
  }

  resize() {
    this.w = this.container.clientWidth;
    this.h = this.container.clientHeight;
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.w, this.h);
  }
}

function init() {
  this.canvas = new Canvas();
  holdCenter = false;

  this.canvas.container.addEventListener("mousemove", (e) => {
    if (holdCenter) {
      canvas.mouseMoved(e.clientX, e.clientY);
    }
    this.canvas.mouse.x = e.clientX - this.canvas.w / 2;
    this.canvas.mouse.y = -e.clientY + this.canvas.h / 2;
  });
  this.canvas.container.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      this.canvas.openBox(e.clientX, e.clientY);
    }
    if (e.button === 1) {
      holdCenter = true;
    }
    if (e.button === 2) {
      this.canvas.setFlag(e.clientX, e.clientY);
    }
  });
  this.canvas.container.addEventListener("mouseup", (e) => {
    if (e.button === 1) {
      holdCenter = false;
    }
  });
  this.canvas.container.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
  window.addEventListener("resize", () => {
    this.canvas.resize();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code == "ControlLeft") {
      holdCenter = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code == "ControlLeft") {
      holdCenter = false;
    }
  });
  this.canvas.container.addEventListener("mousewheel", (e) => {
    this.canvas.zoom(e.wheelDelta);
  });
  document.getElementById("start").addEventListener("click", () => {
    this.canvas.restart();
  });

}
