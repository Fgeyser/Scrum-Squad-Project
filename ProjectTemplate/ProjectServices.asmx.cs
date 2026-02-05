using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Services;
using MySql.Data;
using MySql.Data.MySqlClient;
using System.Data;
using ProjectTemplate.Models;
using ProjectTemplate.Services;

namespace ProjectTemplate
{
	[WebService(Namespace = "http://tempuri.org/")]
	[WebServiceBinding(ConformsTo = WsiProfiles.BasicProfile1_1)]
	[System.ComponentModel.ToolboxItem(false)]
	[System.Web.Script.Services.ScriptService]
	public class ProjectServices : System.Web.Services.WebService
	{
		////////////////////////////////////////////////////////////////////////
		///replace the values of these variables with your database credentials
		////////////////////////////////////////////////////////////////////////
		private string dbID = "cis440Spring2026team2";
		private string dbPass = "cis440Spring2026team2";
		private string dbName = "cis440Spring2026team2";
		////////////////////////////////////////////////////////////////////////

		////////////////////////////////////////////////////////////////////////
		///call this method anywhere that you need the connection string!
		////////////////////////////////////////////////////////////////////////
		private string getConString()
		{
			return "SERVER=107.180.1.16; PORT=3306; DATABASE=" + dbName + "; UID=" + dbID + "; PASSWORD=" + dbPass;
		}
		////////////////////////////////////////////////////////////////////////


		/////////////////////////////////////////////////////////////////////////
		//don't forget to include this decoration above each method that you want
		//to be exposed as a web service!
		[WebMethod(EnableSession = true)]
		/////////////////////////////////////////////////////////////////////////
		public string TestConnection()
		{
			try
			{
				string testQuery = "select * from test";

				////////////////////////////////////////////////////////////////////////
				///here's an example of using the getConString method!
				////////////////////////////////////////////////////////////////////////
				MySqlConnection con = new MySqlConnection(getConString());
				////////////////////////////////////////////////////////////////////////

				MySqlCommand cmd = new MySqlCommand(testQuery, con);
				MySqlDataAdapter adapter = new MySqlDataAdapter(cmd);
				DataTable table = new DataTable();
				adapter.Fill(table);
				return "Success!";
			}
			catch (Exception e)
			{
				return "Something went wrong, please check your credentials and db name and try again.  Error: " + e.Message;
			}
		}

		/////////////////////////////////////////////////////////////////////////
		// NEW: SubmitAnonymousFeedback - saves anonymous feedback to App_Data storage
		/////////////////////////////////////////////////////////////////////////
		[WebMethod(EnableSession = true)]
		public string SubmitAnonymousFeedback(string issue, string impact, string suggestion)
		{
			try
			{
				var fb = new Feedback
				{
					Issue = issue,
					Impact = impact,
					Suggestion = suggestion,
					CreatedAt = DateTime.UtcNow
				};

				// If ThemeMapper exists, assign a theme (defensive call)
				try
				{
					ThemeMapper.AssignTheme(fb);
				}
				catch
				{
					// ignore if ThemeMapper not available
				}

				// Save using the JSON storage helper
				FeedbackStorage.Save(fb);

				return "ok";
			}
			catch (Exception ex)
			{
				// Return error message for debugging (you may prefer to return a generic message)
				return "error: " + ex.Message;
			}
		}

		/////////////////////////////////////////////////////////////////////////
		// NEW: GetAllFeedback - returns all saved feedback entries
		/////////////////////////////////////////////////////////////////////////
		[WebMethod(EnableSession = true)]
		public List<Feedback> GetAllFeedback()
		{
			try
			{
				return FeedbackStorage.GetAll();
			}
			catch
			{
				// On failure, return an empty list rather than null
				return new List<Feedback>();
			}
		}
	}
}
