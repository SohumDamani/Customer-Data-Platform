import { useState, useEffect } from "react";

function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch(`http://localhost:8000/customers?page=${page}&page_size=20&search=${search}`)
      .then((response) => response.json())
      .then((data) => {
        setCustomers(data);
        setLoading(false);
      });
  }, [search,page]);

  return (
    <div>
      {loading ? (
        <p> Loading ....</p>
      ) : (
        <div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
          <table>
            <caption>Customers</caption>
            <tr>
              <th>id</th>
              <th>firstname</th>
              <th>lastname</th>
              <th>email</th>
              <th>phone</th>
              <th>region</th>
            </tr>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.id}</td>
                <td>{customer.firstname}</td>
                <td>{customer.lastname}</td>
                <td>{customer.email}</td>
                <td>{customer.phone}</td>
                <td>{customer.region}</td>
              </tr>
            ))}
          </table>
          <div>
          <button onClick={()=> setPage(page>1?page-1:1)}> Previous Page</button>
          <button onClick={()=> setPage(page+1)}> Next Page</button>
          </div>

        </div>
      )}
    </div>
  );
}

export default App;
