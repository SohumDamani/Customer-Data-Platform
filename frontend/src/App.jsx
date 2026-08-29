import { useState, useEffect } from "react";
import "./App.css";


function App() {
  const [customers, setCustomers] = useState({ result: [], total: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const API_BASE = "http://localhost:8000";
  const [showForm, setShowForm] = useState(false)
  const defaultCustomer = {
    firstname: "",
    lastname: "",
    company: "",
    email: "",
    phone: "",
    region: ""
  }
  const [newCustomer, setnewCustomer] = useState(defaultCustomer);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setnewCustomer(prevCustomer => ({
      ...prevCustomer,
      [name]: value
    }));
  }

  async function handleNewCustomer(event) {
    event.preventDefault();
    const res = await fetch(`${API_BASE}/customers`,{
      method : "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newCustomer)
    })
    const data = await res.json();
    if(!res.ok){
      alert(data.detail.map(err => err.msg).join(", "))
    }else{
      setShowForm(false);
      setnewCustomer(defaultCustomer);
      return fetchCustomer();

    }
  }

  function fetchCustomer(){
    const timer = setTimeout(() => {
      setFetching(true);
      fetch(
        `${API_BASE}/customers?page=${page}&page_size=${pageSize}&search=${search}`,
      )
        .then((response) => response.json())
        .then((data) => {
          setCustomers(data);
          setInitialLoading(false);
          setFetching(false);
        });
    }, 400);
    return () => clearTimeout(timer);
  }

  useEffect(() => {
    return fetchCustomer()
  }, [search,page]);

  const results = customers.result;
  const total = customers.total;
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  return (
    <div className="app">
      <div className="app-header">
        <h1>Customer Directory</h1>
        <p>Search by name or company across all records.</p>
        <button className="add-customer-btn" disabled= {showForm} onClick={()=> setShowForm(true)}>Add Customer</button>
      </div>
      { showForm 
        && 
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal-form" onClick={(e)=> e.stopPropagation()} onSubmit={handleNewCustomer}>
            <h2>Create New Customer</h2>

            <input className="form-input" type="text" name ="firstname" placeholder="First Name" value = {newCustomer.firstname} onChange={handleFormChange} />
            <input className="form-input" type="text" name="lastname" placeholder="Last Name" value = {newCustomer.lastname} onChange={handleFormChange} />
            <input className="form-input" type="text" name="company" placeholder="Company" value = {newCustomer.company} onChange={handleFormChange} />
            <input className="form-input" type="email" name="email" placeholder="Email" value = {newCustomer.email} onChange={handleFormChange} />
            <input className="form-input" type="tel" name="phone" placeholder="Phone" value = {newCustomer.phone} onChange={handleFormChange} />
            <input className="form-input" type="text" name="region" placeholder="Region" value = {newCustomer.region} onChange={handleFormChange} />
            <button className="modal-submit-btn" type="submit">Submit</button>
          </form>
        </div>
      }
      <input
        className="search-bar"
        placeholder="Search customers..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <div className={`table-wrap${fetching ? " table-wrap--fetching" : ""}`}>
        {" "}
        {initialLoading ? (
          <div className="loading-state">Loading customers...</div>
        ) : results.length === 0 ? (
          <div className="empty-state">No customers match "{search}".</div>
        ) : (
          <div>
            <table>
              <thead>
                <tr>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Region</th>
                </tr>
              </thead>
              <tbody>
                {results.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.firstname}</td>
                    <td>{customer.lastname}</td>
                    <td>{customer.company}</td>
                    <td>{customer.email}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="status-bar">
        <span>
          {total > 0 ? `Showing ${startRow}–${endRow} of ${total}` : ""}
        </span>
        <div className="pagination">
          <button onClick={() => setPage(page - 1)} disabled={page === 1}>
            Previous
          </button>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * pageSize >= total}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
