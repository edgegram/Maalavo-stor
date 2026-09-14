const $ = id => document.getElementById(id);

function toast(message, type = "info") {
  const el = $("toast");

  if (!el) return;

  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("show");

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(
    () => el.classList.remove("show"),
    3000
  );
}


async function api(path, options = {}) {

  const response = await fetch(path, {
    ...options,

    credentials: "same-origin",

    cache: "no-store",

    headers: {
      ...(options.body
        ? {
            "Content-Type":
              "application/json"
          }
        : {}),

      ...(options.headers || {})
    }
  });


  const text =
    await response.text();

  let data = {};

  try {

    data = text
      ? JSON.parse(text)
      : {};

  } catch {

    throw new Error(
      `Сервер вернул не JSON (${response.status})`
    );

  }


  if (!response.ok) {

    throw new Error(
      data.error ||
      `Ошибка сервера: ${response.status}`
    );

  }

  return data;
}


/* =========================
   LOGIN
========================= */

async function login(event) {

  if (event) {
    event.preventDefault();
  }

  const button =
    $("loginButton");

  const password =
    $("password").value.trim();


  if (!password) {

    toast(
      "Введи пароль администратора",
      "error"
    );

    $("password").focus();

    return;
  }


  button.disabled = true;
  button.textContent = "Проверяем…";


  try {

    const data =
      await api(
        "/api/admin/login",
        {
          method: "POST",

          body: JSON.stringify({
            password
          })
        }
      );


    if (!data.ok) {

      throw new Error(
        "Сервер не подтвердил вход"
      );

    }


    toast(
      "Вход выполнен",
      "success"
    );


    await showApp();

  } catch (error) {

    console.error(
      "ADMIN LOGIN:",
      error
    );

    toast(
      error.message ||
      "Не удалось войти",
      "error"
    );

  } finally {

    button.disabled = false;
    button.textContent = "Войти";

  }
}


async function showApp() {

  try {

    await api(
      "/api/admin/me"
    );


    $("login")
      .classList
      .add("hidden");


    $("app")
      .classList
      .remove("hidden");


    await loadAll();

  } catch (error) {

    $("login")
      .classList
      .remove("hidden");


    $("app")
      .classList
      .add("hidden");


    throw error;
  }
}


/* =========================
   TABS
========================= */

function tab(name, button) {

  document
    .querySelectorAll(".tab")
    .forEach(
      el =>
        el.classList.add("hidden")
    );


  $(name)
    .classList
    .remove("hidden");


  document
    .querySelectorAll(".tabs button")
    .forEach(
      el =>
        el.classList.remove("active")
    );


  button.classList.add("active");
}


/* =========================
   LOAD
========================= */

async function loadAll() {

  try {

    const [
      stats,
      products,
      orders,
      users,
      about
    ] = await Promise.all([

      api("/api/admin/stats"),

      api("/api/admin/products"),

      api("/api/admin/orders"),

      api("/api/admin/users"),

      api("/api/admin/about")

    ]);


    $("sUsers").textContent =
      stats.users ?? 0;

    $("sProducts").textContent =
      stats.products ?? 0;

    $("sOrders").textContent =
      stats.orders ?? 0;

    $("sRevenue").textContent =
      money(stats.revenue ?? 0);


    renderProducts(
      products.products || []
    );


    renderOrders(
      orders.orders || []
    );


    renderUsers(
      users.users || []
    );


    $("aboutTitle").value =
      about.title || "";


    $("aboutText").value =
      about.text || "";


  } catch (error) {

    console.error(
      "ADMIN LOAD:",
      error
    );

    toast(
      error.message ||
      "Не удалось загрузить данные",
      "error"
    );
  }
}


function money(value) {

  return new Intl.NumberFormat(
    "ru-RU"
  ).format(
    Number(value) || 0
  ) + " ₽";

}


function esc(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    char =>
      ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
      })[char]
  );

}


/* =========================
   PRODUCTS
========================= */

function renderProducts(list) {

  const box =
    $("productsList");


  box.innerHTML =
    list.map(p => `

      <div class="row">

        <div class="rowMain">

          ${
            p.image
              ? `
                <img
                  class="thumb"
                  src="${esc(p.image)}"
                  onerror="this.style.display='none'"
                >
              `
              : ""
          }

          <div>

            <b>
              ${esc(p.name)}
            </b>

            <div class="meta">
              ${money(p.price)}
              ·
              ${esc(p.category)}
              ·
              ${
                p.active
                  ? "активен"
                  : "скрыт"
              }
            </div>

            <div class="meta">
              ${esc(
                p.description || ""
              )}
            </div>

          </div>

        </div>


        <div class="rowActions">

          <button
            class="btn"
            onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'
          >
            Изменить
          </button>


          ${
            p.active
              ? `
                <button
                  class="btn danger"
                  onclick="deleteProduct('${esc(p.id)}')"
                >
                  Скрыть
                </button>
              `
              : ""
          }

        </div>

      </div>

    `).join("")

    ||

    `
      <div class="empty">
        Товаров пока нет.
      </div>
    `;
}


async function addProduct() {

  const payload = {

    name:
      $("pName")
        .value
        .trim(),

    category:
      $("pCat").value,

    price:
      Number(
        $("pPrice").value
      ),

    tag:
      $("pTag")
        .value
        .trim(),

    description:
      $("pDesc")
        .value
        .trim(),

    image:
      $("pImage")
        .value
        .trim()

  };


  if (!payload.name) {

    return toast(
      "Укажи название товара",
      "error"
    );

  }


  if (
    !Number.isFinite(
      payload.price
    ) ||
    payload.price < 0
  ) {

    return toast(
      "Укажи корректную цену",
      "error"
    );

  }


  try {

    await api(
      "/api/admin/products",
      {
        method: "POST",

        body:
          JSON.stringify(
            payload
          )
      }
    );


    [
      "pName",
      "pPrice",
      "pTag",
      "pDesc",
      "pImage"
    ].forEach(
      id =>
        $(id).value = ""
    );


    toast(
      "Товар добавлен",
      "success"
    );


    await loadAll();

  } catch (error) {

    toast(
      error.message,
      "error"
    );

  }
}


async function editProduct(product) {

  const name =
    prompt(
      "Название товара:",
      product.name
    );


  if (name === null) {
    return;
  }


  const priceText =
    prompt(
      "Цена в ₽:",
      product.price
    );


  if (priceText === null) {
    return;
  }


  const price =
    Number(priceText);


  if (
    !Number.isFinite(price) ||
    price < 0
  ) {

    return toast(
      "Некорректная цена",
      "error"
    );

  }


  const description =
    prompt(
      "Описание:",
      product.description || ""
    );


  if (description === null) {
    return;
  }


  try {

    await api(
      "/api/admin/products/" +
      encodeURIComponent(
        product.id
      ),
      {
        method: "PUT",

        body:
          JSON.stringify({
            ...product,
            name:
              name.trim(),
            price,
            description
          })
      }
    );


    toast(
      "Товар сохранён",
      "success"
    );


    await loadAll();

  } catch (error) {

    toast(
      error.message,
      "error"
    );

  }
}


async function deleteProduct(id) {

  if (
    !confirm(
      "Скрыть этот товар из каталога?"
    )
  ) {
    return;
  }


  try {

    await api(
      "/api/admin/products/" +
      encodeURIComponent(id),
      {
        method: "DELETE"
      }
    );


    toast(
      "Товар скрыт",
      "success"
    );


    await loadAll();

  } catch (error) {

    toast(
      error.message,
      "error"
    );

  }
}


/* =========================
   ORDERS
========================= */

function renderOrders(list) {

  $("ordersList").innerHTML =
    list.map(o => `

      <div class="row">

        <div>

          <b>
            ${esc(o.id)}
          </b>

          <div class="meta">

            ${esc(
              o.customer_name ||
              "Без имени"
            )}

            ${
              o.customer_username
                ? " · @" +
                  esc(
                    o.customer_username
                  )
                : ""
            }

          </div>

          <div class="meta">

            ${
              new Date(
                o.created_at
              ).toLocaleString(
                "ru-RU"
              )
            }

          </div>

          <div class="meta">

            ${
              (o.items || [])
                .map(
                  i =>
                    `${esc(i.name)} × ${i.qty}`
                )
                .join(", ")
            }

          </div>

        </div>


        <div class="rowActions">

          <strong>
            ${money(o.total)}
          </strong>

          <select
            onchange="setStatus('${esc(o.id)}', this.value)"
          >

            ${statusOption(
              "pending",
              "Ожидает",
              o.status
            )}

            ${statusOption(
              "paid",
              "Оплачен",
              o.status
            )}

            ${statusOption(
              "processing",
              "В работе",
              o.status
            )}

            ${statusOption(
              "completed",
              "Готов",
              o.status
            )}

            ${statusOption(
              "cancelled",
              "Отменён",
              o.status
            )}

          </select>

        </div>

      </div>

    `).join("")

    ||

    `
      <div class="empty">
        Заказов пока нет.
      </div>
    `;
}


function statusOption(
  value,
  label,
  current
) {

  return `
    <option
      value="${value}"
      ${
        value === current
          ? "selected"
          : ""
      }
    >
      ${label}
    </option>
  `;

}


async function setStatus(
  id,
  status
) {

  try {

    await api(
      "/api/admin/orders/" +
      encodeURIComponent(id),
      {
        method: "PUT",

        body:
          JSON.stringify({
            status
          })
      }
    );


    toast(
      "Статус обновлён",
      "success"
    );


    await loadAll();

  } catch (error) {

    toast(
      error.message,
      "error"
    );

  }
}


/* =========================
   USERS
========================= */

function renderUsers(list) {

  $("usersList").innerHTML =
    list.map(u => `

      <div class="row">

        <div>

          <b>

            ${esc(
              [
                u.first_name,
                u.last_name
              ]
              .filter(Boolean)
              .join(" ")
              ||
              "Без имени"
            )}

          </b>

          <div class="meta">

            ID
            ${esc(u.id)}

            ·

            ${
              u.username
                ? "@" +
                  esc(u.username)
                : "нет username"
            }

          </div>

        </div>


        <div>

          <b>
            ${u.orders || 0}
          </b>

          заказов

          <div class="meta">

            ${money(
              u.spent || 0
            )}

          </div>

        </div>

      </div>

    `).join("")

    ||

    `
      <div class="empty">
        Пользователей пока нет.
      </div>
    `;
}


/* =========================
   ABOUT
========================= */

async function saveAbout() {

  try {

    await api(
      "/api/admin/about",
      {
        method: "PUT",

        body:
          JSON.stringify({
            title:
              $("aboutTitle").value,

            text:
              $("aboutText").value
          })
      }
    );


    toast(
      "Раздел сохранён",
      "success"
    );

  } catch (error) {

    toast(
      error.message,
      "error"
    );

  }
}


/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    $("loginForm")
      .addEventListener(
        "submit",
        login
      );


    $("password")
      .addEventListener(
        "keydown",
        e => {

          if (
            e.key === "Enter"
          ) {
            login(e);
          }

        }
      );


    try {

      await showApp();

    } catch {

      // Пользователь ещё не авторизован.
      // Оставляем экран входа.

    }

  }
);