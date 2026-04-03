const form = document.getElementById("appointmentForm");
const employeeSelect = document.getElementById("professional");
const serviceSelect = document.getElementById("service");
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");


// CARGAR EMPLEADOS
async function loadEmployees(){

const res = await fetch("/api/employees");
const employees = await res.json();

employees.forEach(emp => {

const option = document.createElement("option");
option.value = emp.id;
option.textContent = emp.nombre;

employeeSelect.appendChild(option);

});

}


// CARGAR SERVICIOS
async function loadServices(){

const res = await fetch("/api/services");
const services = await res.json();

services.forEach(serv => {

const option = document.createElement("option");
option.value = serv.id;
option.textContent = serv.nombre;

serviceSelect.appendChild(option);

});

}


// CARGAR HORARIOS DISPONIBLES
async function loadTimes(){

const empleado_id = employeeSelect.value;
const fecha = dateInput.value;

if(!empleado_id || !fecha) return;

const res = await fetch(`/api/available-times?empleado_id=${empleado_id}&fecha=${fecha}`);
const times = await res.json();

timeSelect.innerHTML = "";

times.forEach(time => {

const option = document.createElement("option");
option.value = time;
option.textContent = time;

timeSelect.appendChild(option);

});

}


// EVENTOS
employeeSelect.addEventListener("change", loadTimes);
dateInput.addEventListener("change", loadTimes);


// CREAR CITA
form.addEventListener("submit", async function(e){

e.preventDefault();

const data = {

name: document.getElementById("name").value,
phone: document.getElementById("phone").value,
servicio_id: serviceSelect.value,
empleado_id: employeeSelect.value,
date: dateInput.value,
time: timeSelect.value

};

const response = await fetch("/api/appointments",{

method:"POST",
headers:{
"Content-Type":"application/json"
},
body: JSON.stringify(data)

});

const result = await response.json();

alert(result.message);

});


// INICIAR
loadEmployees();
loadServices();